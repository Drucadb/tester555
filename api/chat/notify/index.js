const connectDB = require('../../../lib/db');
const User = require('../../../models/User');

// Modelo de Notificação (se não existir)
const mongoose = require('mongoose');
const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['chat', 'system', 'invite'], default: 'chat' },
  message: { type: String, required: true },
  data: { type: Object, default: {} },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    await connectDB();

    const { userId, username, message, chatId, isAdmin, fromUser } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ 
        message: 'Dados incompletos' 
      });
    }

    // Criar notificação
    const notificationMessage = isAdmin 
      ? `👑 Admin ${username} respondeu sua mensagem: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
      : `💬 ${username} enviou uma mensagem: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`;

    await Notification.create({
      userId,
      type: 'chat',
      message: notificationMessage,
      data: { 
        chatId, 
        fromUser, 
        isAdmin,
        sender: username
      },
      createdAt: new Date()
    });

    // Também salvar como mensagem para o admin ver
    // (O admin já vê todas as mensagens via GET)

    return res.status(200).json({ 
      message: 'Notificação criada com sucesso' 
    });

  } catch (error) {
    console.error('❌ Erro na notificação:', error);
    return res.status(500).json({ 
      message: 'Erro ao criar notificação' 
    });
  }
};