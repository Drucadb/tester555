const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const Invite = require('../../../models/Invite');
const jwt = require('jsonwebtoken');

async function verifyAuth(req) {
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
    
    return { user };
  } catch (error) {
    return { error: 'Token inválido', status: 401 };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ message: auth.error });
  }

  try {
    await connectDB();

    const { maxUses = 10, expiresIn = null } = req.body;
    const user = auth.user;

    // Verificar limite de convites (opcional)
    const userInvites = await Invite.countDocuments({ 
      creator: user._id,
      isActive: true
    });

    if (userInvites >= 50) {
      return res.status(400).json({ 
        message: 'Limite de convites ativos atingido (50)' 
      });
    }

    // Gerar código único
    let code;
    let exists = true;
    let attempts = 0;
    
    while (exists && attempts < 10) {
      code = Invite.generateCode();
      const existing = await Invite.findOne({ code });
      if (!existing) exists = false;
      attempts++;
    }

    if (exists) {
      return res.status(500).json({ 
        message: 'Erro ao gerar código, tente novamente' 
      });
    }

    // Criar convite
    const invite = await Invite.create({
      code,
      creator: user._id,
      maxUses,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null,
      rewards: {
        creator: {
          recoveryAttempts: 5,
          role: 'premium'
        },
        user: {
          recoveryAttempts: 3
        }
      }
    });

    // Atualizar usuário
    await User.findByIdAndUpdate(user._id, {
      $inc: { recoveryAttempts: 1 }
    });

    return res.status(201).json({
      message: 'Convite criado com sucesso! ✨',
      invite: {
        code: invite.code,
        maxUses: invite.maxUses,
        uses: invite.uses,
        expiresAt: invite.expiresAt,
        link: `${process.env.NEXTAUTH_URL || 'https://seu-site.vercel.app'}/convite?code=${invite.code}`
      }
    });

  } catch (error) {
    console.error('❌ Erro ao criar convite:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar convite' 
    });
  }
};