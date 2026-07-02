// api/detect/index.js

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido. Use GET.' });
    }

    // ===== PEGAR IP DO VISITANTE =====
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               'IP não identificado';
    
    const ipFinal = ip.split(',')[0].trim();

    // ===== DETECTAR NAVEGADOR ANÔNIMO =====
    const isPrivate = detectPrivateBrowsing(req);

    // ===== DETECTAR VPN/PROXY =====
    const vpnInfo = await detectVPNMultiMethod(ipFinal, req);

    // ===== CALCULAR PONTUAÇÃO DE RISCO =====
    const riskScore = calculateRiskScore(isPrivate, vpnInfo);

    // ===== RESULTADO FINAL =====
    const blocked = riskScore >= 50;

    res.status(200).json({
        success: true,
        data: {
            ip: ipFinal,
            isPrivate: isPrivate,
            vpn: vpnInfo,
            riskScore: riskScore,
            riskLevel: getRiskLevel(riskScore),
            blocked: blocked,
            message: blocked ? '🚫 Acesso bloqueado!' : '✅ Acesso permitido!',
            timestamp: new Date().toISOString()
        }
    });
}

// ============================================================
// 1. DETECÇÃO DE NAVEGADOR ANÔNIMO (MELHORADA)
// ============================================================
function detectPrivateBrowsing(req) {
    const headers = req.headers;
    const userAgent = headers['user-agent'] || '';
    let score = 0;
    let reasons = [];

    // 1. User Agent suspeito
    const suspiciousUA = [
        'Headless', 'PhantomJS', 'Puppeteer', 'Selenium', 
        'Chrome-Lighthouse', 'webdriver', 'HeadlessChrome'
    ];
    
    for (const sus of suspiciousUA) {
        if (userAgent.includes(sus)) {
            score += 30;
            reasons.push('User Agent suspeito');
            break;
        }
    }

    // 2. Headers ausentes ou suspeitos
    if (!headers['accept-language']) {
        score += 15;
        reasons.push('Accept-Language ausente');
    }

    if (!headers['accept-encoding']) {
        score += 10;
        reasons.push('Accept-Encoding ausente');
    }

    // 3. DNT + sem preferências (comum em anônimo)
    if (headers['dnt'] === '1' && !headers['sec-ch-ua-mobile']) {
        score += 10;
        reasons.push('DNT ativado sem preferências');
    }

    // 4. User Agent muito curto ou incompleto
    if (userAgent.length < 20) {
        score += 15;
        reasons.push('User Agent muito curto');
    }

    // 5. Headers de navegador incompletos
    const requiredHeaders = ['accept', 'accept-encoding', 'accept-language', 'user-agent'];
    let missingHeaders = requiredHeaders.filter(h => !headers[h]);
    if (missingHeaders.length > 1) {
        score += 10;
        reasons.push(`Headers ausentes: ${missingHeaders.join(', ')}`);
    }

    return {
        isPrivate: score >= 30,
        score: score,
        reasons: reasons,
        level: score >= 50 ? 'Alto' : score >= 30 ? 'Médio' : 'Baixo'
    };
}

// ============================================================
// 2. DETECÇÃO DE VPN/PROXY (MULTI-MÉTODO)
// ============================================================
async function detectVPNMultiMethod(ip, req) {
    const results = {
        isVPN: false,
        score: 0,
        details: {
            country: 'Desconhecido',
            region: 'Desconhecido',
            city: 'Desconhecido',
            isp: 'Desconhecido',
            org: 'Desconhecido',
            isProxy: false,
            isDatacenter: false,
            isHosting: false,
            isMobile: false,
            methods: [],
            reasons: []
        }
    };

    // ===== MÉTODO 1: ip-api.com =====
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,org,proxy,hosting,query,mobile,timezone`);
        const data = await response.json();
        
        if (data.status === 'success') {
            results.details.country = data.country || 'Desconhecido';
            results.details.region = data.regionName || 'Desconhecido';
            results.details.city = data.city || 'Desconhecido';
            results.details.isp = data.isp || 'Desconhecido';
            results.details.org = data.org || 'Desconhecido';
            results.details.isProxy = data.proxy === true;
            results.details.isHosting = data.hosting === true;
            results.details.isMobile = data.mobile === true;
            results.details.methods.push('ip-api.com');
            
            if (data.proxy) {
                results.score += 40;
                results.details.reasons.push('Proxy detectado (ip-api)');
            }
            if (data.hosting) {
                results.score += 30;
                results.details.reasons.push('Hosting/DataCenter detectado (ip-api)');
            }
        }
    } catch (e) {
        console.warn('ip-api.com falhou:', e.message);
    }

    // ===== MÉTODO 2: ipapi.co =====
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await response.json();
        
        if (data && !data.error) {
            if (data.proxy === true) {
                results.score += 20;
                results.details.reasons.push('Proxy detectado (ipapi.co)');
                results.details.isProxy = true;
                results.details.methods.push('ipapi.co');
            }
            if (data.hosting === true) {
                results.score += 15;
                results.details.reasons.push('Hosting detectado (ipapi.co)');
                results.details.isHosting = true;
                results.details.methods.push('ipapi.co');
            }
        }
    } catch (e) {
        console.warn('ipapi.co falhou:', e.message);
    }

    // ===== MÉTODO 3: Lista de Datacenters =====
    const datacenterKeywords = [
        'amazon', 'aws', 'azure', 'google', 'cloud', 'digitalocean', 
        'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare', 'akamai', 
        'fastly', 'cloudfront', 'heroku', 'vercel', 'netlify',
        'alibaba', 'tencent', 'oracle cloud', 'ibm cloud',
        'rackspace', 'dreamhost', 'bluehost', 'hostgator'
    ];
    
    const ispLower = (results.details.isp || '').toLowerCase();
    const orgLower = (results.details.org || '').toLowerCase();
    
    for (const dc of datacenterKeywords) {
        if (ispLower.includes(dc) || orgLower.includes(dc)) {
            results.score += 20;
            results.details.isDatacenter = true;
            results.details.reasons.push(`Datacenter detectado: ${dc}`);
            results.details.methods.push('datacenter-list');
            break;
        }
    }

    // ===== MÉTODO 4: Cloudflare Headers =====
    const cfHeaders = req.headers['cf-connecting-ip'] || req.headers['cf-ray'];
    if (cfHeaders) {
        // Isso indica que o usuário está atrás do Cloudflare
        // Não é necessariamente VPN, mas adicionamos um pequeno score
        results.details.methods.push('cloudflare');
        results.details.reasons.push('Usando Cloudflare (possível proxy)');
    }

    // ===== MÉTODO 5: Verificar se é VPN por localização + datacenter =====
    if (results.details.isDatacenter && results.details.country !== 'Brazil') {
        results.score += 10;
        results.details.reasons.push(`VPN suspeita: ${results.details.country} via datacenter`);
    }

    // ===== MÉTODO 6: Verificar se é VPN por ISP suspeito =====
    const suspiciousISPs = ['vpn', 'proxy', 'anonymous', 'private', 'secure', 'shield', 'hide'];
    for (const sus of suspiciousISPs) {
        if (ispLower.includes(sus) || orgLower.includes(sus)) {
            results.score += 25;
            results.details.reasons.push(`ISP suspeito: ${results.details.isp}`);
            results.details.methods.push('suspicious-isp');
            break;
        }
    }

    // ===== DETERMINAR SE É VPN =====
    results.isVPN = results.score >= 30;

    return results;
}

// ============================================================
// 3. CALCULAR PONTUAÇÃO DE RISCO TOTAL
// ============================================================
function calculateRiskScore(isPrivate, vpnInfo) {
    let score = 0;

    // Navegador anônimo
    if (isPrivate.isPrivate) {
        score += isPrivate.score;
    }

    // VPN/Proxy
    score += vpnInfo.score;

    // Se for mobile, reduz o score (menos suspeito)
    if (vpnInfo.details.isMobile) {
        score = Math.max(0, score - 10);
    }

    return Math.min(100, score);
}

// ============================================================
// 4. NÍVEL DE RISCO
// ============================================================
function getRiskLevel(score) {
    if (score >= 70) return { level: '🔴 Crítico', color: '#ef4444', emoji: '🚫' };
    if (score >= 50) return { level: '🟠 Alto', color: '#f97316', emoji: '⚠️' };
    if (score >= 30) return { level: '🟡 Médio', color: '#f59e0b', emoji: '⚡' };
    if (score >= 10) return { level: '🟢 Baixo', color: '#10b981', emoji: '✅' };
    return { level: '🟣 Mínimo', color: '#8b5cf6', emoji: '🏆' };
}
