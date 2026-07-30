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

    const { code } = req.body;
    const user = auth.user;

    if (!code) {
      return res.status(400).json({ 
        message: 'Código de convite é obrigatório' 
      });
    }

    // Buscar convite
    const invite = await Invite.findOne({ 
      code: code.toUpperCase(),
      isActive: true
    });

    if (!invite) {
      return res.status(404).json({ 
        message: 'Convite inválido ou expirado' 
      });
    }

    // Verificar expiração
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({ 
        message: 'Convite expirado' 
      });
    }

    // Verificar uso máximo
    if (invite.uses >= invite.maxUses) {
      return res.status(400).json({ 
        message: 'Convite atingiu o limite de uso' 
      });
    }

    // Verificar se o usuário já usou este convite
    if (invite.usedBy.includes(user._id)) {
      return res.status(400).json({ 
        message: 'Você já usou este convite' 
      });
    }

    // Não pode usar o próprio convite
    if (invite.creator.toString() === user._id.toString()) {
      return res.status(400).json({ 
        message: 'Você não pode usar seu próprio convite' 
      });
    }

    // Aplicar recompensas para o usuário
    const userRewards = invite.rewards.user || {};
    const creatorRewards = invite.rewards.creator || {};

    // Atualizar usuário que usou o convite
    if (userRewards.recoveryAttempts) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { recoveryAttempts: userRewards.recoveryAttempts }
      });
    }

    // Atualizar criador do convite
    if (creatorRewards.recoveryAttempts) {
      await User.findByIdAndUpdate(invite.creator, {
        $inc: { recoveryAttempts: creatorRewards.recoveryAttempts }
      });
    }

    // Se der role premium
    if (creatorRewards.role) {
      await User.findByIdAndUpdate(invite.creator, {
        plan: creatorRewards.role,
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      });
    }

    // Atualizar convite
    invite.usedBy.push(user._id);
    invite.uses += 1;
    await invite.save();

    return res.status(200).json({
      message: 'Convite utilizado com sucesso! 🎉',
      rewards: {
        user: userRewards,
        creator: creatorRewards
      }
    });

  } catch (error) {
    console.error('❌ Erro ao usar convite:', error);
    return res.status(500).json({ 
      message: 'Erro ao usar convite' 
    });
  }
};