const connectDB = require('../../../lib/db');
const User = require('../../../models/User');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { username, email, password } = req.body;

    // Validar campos
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'Todos os campos são obrigatórios' 
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Email inválido' 
      });
    }

    // Validar senha
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Senha deve ter pelo menos 6 caracteres' 
      });
    }

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Usuário ou email já cadastrado' 
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Verificar se é o PRIMEIRO usuário (vira admin)
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    // Criar usuário
    const user = await User.create({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    // Se for o primeiro usuário, mostrar mensagem especial
    const message = role === 'admin' 
      ? '🎉 Conta ADMIN criada com sucesso! Você é o administrador do sistema.'
      : 'Usuário criado com sucesso! ✨';

    // Remover senha do retorno
    const userWithoutPassword = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      message,
      user: userWithoutPassword,
      isAdmin: role === 'admin',
    });

  } catch (error) {
    console.error('❌ Erro no registro:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar usuário' 
    });
  }
};