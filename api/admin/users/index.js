const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const jwt = require('jsonwebtoken');

// Middleware para verificar se é admin
async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token não fornecido', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    await connectDB();
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return { error: 'Usuário não encontrado', status: 404 };
    }
    
    if (user.role !== 'admin') {
      return { error: 'Acesso negado. Você não é administrador.', status: 403 };
    }
    
    return { user };
  } catch (error) {
    return { error: 'Token inválido', status: 401 };
  }
}

module.exports = async (req, res) => {
  // Verificar se é admin
  const auth = await verifyAdmin(req);
  if (auth.error) {
    return res.status(auth.status).json({ message: auth.error });
  }

  try {
    await connectDB();

    // ===== GET - Listar todos os usuários =====
    if (req.method === 'GET') {
      const { page = 1, limit = 50, search } = req.query;
      
      let query = {};
      if (search) {
        query = {
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(query),
      ]);

      // Estatísticas
      const stats = {
        total: await User.countDocuments(),
        admins: await User.countDocuments({ role: 'admin' }),
        banned: await User.countDocuments({ isBanned: true }),
        users: await User.countDocuments({ role: 'user' }),
        totalRecoveryAttempts: await User.aggregate([
          { $group: { _id: null, total: { $sum: '$recoveryAttempts' } } },
        ]),
      };

      return res.status(200).json({
        users,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        stats,
      });
    }

    // ===== POST - Banir usuário =====
    if (req.method === 'POST') {
      const { userId, email, reason, expiresIn, permanent } = req.body;

      if (!userId && !email) {
        return res.status(400).json({ 
          message: 'Forneça userId ou email para banir' 
        });
      }

      // Não pode banir a si mesmo
      if (userId === auth.user._id.toString()) {
        return res.status(400).json({ 
          message: 'Você não pode banir a si mesmo' 
        });
      }

      const query = userId ? { _id: userId } : { email: email.toLowerCase() };
      const user = await User.findOne(query);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Não pode banir outro admin
      if (user.role === 'admin') {
        return res.status(400).json({ 
          message: 'Não é possível banir outro administrador' 
        });
      }

      if (user.isBanned) {
        return res.status(400).json({ message: 'Usuário já está banido' });
      }

      let bannedUntil = null;
      if (!permanent && expiresIn) {
        bannedUntil = new Date(Date.now() + expiresIn);
      }

      user.isBanned = true;
      user.banReason = reason || 'Atividade suspeita';
      user.bannedUntil = bannedUntil;
      await user.save();

      return res.status(200).json({
        message: permanent ? 'Usuário banido permanentemente!' : 'Usuário banido com sucesso!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isBanned: user.isBanned,
          banReason: user.banReason,
          bannedUntil: user.bannedUntil,
        },
      });
    }

    // ===== DELETE - Desbanir usuário =====
    if (req.method === 'DELETE') {
      const { userId, email } = req.body;

      if (!userId && !email) {
        return res.status(400).json({ 
          message: 'Forneça userId ou email para desbanir' 
        });
      }

      const query = userId ? { _id: userId } : { email: email.toLowerCase() };
      const user = await User.findOne(query);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      if (!user.isBanned) {
        return res.status(400).json({ message: 'Usuário não está banido' });
      }

      user.isBanned = false;
      user.banReason = null;
      user.bannedUntil = null;
      await user.save();

      return res.status(200).json({
        message: 'Usuário desbanido com sucesso!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isBanned: user.isBanned,
        },
      });
    }

    return res.status(405).json({ message: 'Método não permitido' });

  } catch (error) {
    console.error('❌ Erro no admin:', error);
    return res.status(500).json({ 
      message: 'Erro ao processar requisição' 
    });
  }
};
