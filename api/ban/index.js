const connectDB = require('../../../lib/db');
const User = require('../../../models/User');

module.exports = async (req, res) => {
  // Permitir apenas POST, GET, DELETE
  if (!['POST', 'GET', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    // ===== VERIFICAR SE É ADMIN (opcional) =====
    // Você pode adicionar uma verificação de token/admin aqui
    // const token = req.headers.authorization?.split(' ')[1];
    // if (!token || !isAdmin(token)) {
    //   return res.status(403).json({ message: 'Acesso negado' });
    // }

    // ===== GET - Listar contas banidas =====
    if (req.method === 'GET') {
      const bannedUsers = await User.find({
        isBanned: true,
        $or: [
          { bannedUntil: { $exists: false } },
          { bannedUntil: { $gt: new Date() } },
        ],
      }).select('-password -__v');

      return res.status(200).json({
        count: bannedUsers.length,
        users: bannedUsers,
      });
    }

    // ===== POST - Banir uma conta =====
    if (req.method === 'POST') {
      const { userId, email, reason, expiresIn, permanent } = req.body;

      if (!userId && !email) {
        return res.status(400).json({ 
          message: 'Forneça userId ou email para banir' 
        });
      }

      // Buscar usuário
      const query = userId ? { _id: userId } : { email: email.toLowerCase() };
      const user = await User.findOne(query);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      if (user.isBanned) {
        return res.status(400).json({ message: 'Usuário já está banido' });
      }

      // Calcular data de expiração
      let bannedUntil = null;
      if (!permanent && expiresIn) {
        bannedUntil = new Date(Date.now() + expiresIn);
      }

      // Atualizar usuário
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

    // ===== DELETE - Desbanir uma conta =====
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

      // Remover banimento
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

  } catch (error) {
    console.error('❌ Erro no banimento de conta:', error);
    return res.status(500).json({ 
      message: 'Erro ao processar banimento' 
    });
  }
};