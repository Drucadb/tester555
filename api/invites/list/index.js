const connectDB = require('../../../lib/db');
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
    return { userId: decoded.userId };
  } catch (error) {
    return { error: 'Token inválido', status: 401 };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.status).json({ message: auth.error });
  }

  try {
    await connectDB();

    const invites = await Invite.find({ 
      creator: auth.userId 
    }).sort({ createdAt: -1 });

    const stats = {
      total: invites.length,
      active: invites.filter(i => i.isActive).length,
      totalUses: invites.reduce((sum, i) => sum + i.uses, 0)
    };

    return res.status(200).json({
      invites,
      stats
    });

  } catch (error) {
    console.error('❌ Erro ao listar convites:', error);
    return res.status(500).json({ 
      message: 'Erro ao listar convites' 
    });
  }
};