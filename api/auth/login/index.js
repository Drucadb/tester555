const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email e senha são obrigatórios' 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Credenciais inválidas' 
      });
    }

    // Verificar se o usuário está banido
    if (user.isBanned) {
      if (user.bannedUntil && user.bannedUntil > new Date()) {
        return res.status(403).json({ 
          message: `Conta banida até ${new Date(user.bannedUntil).toLocaleDateString('pt-BR')}`,
          banned: true,
          expires: user.bannedUntil
        });
      } else if (!user.bannedUntil) {
        return res.status(403).json({ 
          message: 'Conta banida permanentemente',
          banned: true,
          permanent: true
        });
      }
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ 
        message: 'Credenciais inválidas' 
      });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    const userWithoutPassword = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    return res.status(200).json({
      user: userWithoutPassword,
      token,
      message: 'Login realizado com sucesso! ✨'
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ 
      message: 'Erro ao fazer login' 
    });
  }
};