const connectDB = require('../../../lib/db');
const Invite = require('../../../models/Invite');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ 
        message: 'Código de convite é obrigatório' 
      });
    }

    const invite = await Invite.findOne({ 
      code: code.toUpperCase(),
      isActive: true
    }).populate('creator', 'username email');

    if (!invite) {
      return res.status(404).json({ 
        message: 'Convite inválido ou expirado',
        valid: false
      });
    }

    // Verificar expiração
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({ 
        message: 'Convite expirado',
        valid: false
      });
    }

    // Verificar uso máximo
    if (invite.uses >= invite.maxUses) {
      return res.status(400).json({ 
        message: 'Convite atingiu o limite de uso',
        valid: false
      });
    }

    return res.status(200).json({
      valid: true,
      invite: {
        code: invite.code,
        creator: invite.creator.username,
        uses: invite.uses,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt
      }
    });

  } catch (error) {
    console.error('❌ Erro ao validar convite:', error);
    return res.status(500).json({ 
      message: 'Erro ao validar convite' 
    });
  }
};