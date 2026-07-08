// /api/detect/index.js

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

    // ===== DETECTAR NAVEGADOR ANÔNIMO (VIA USER-AGENT E HEADERS) =====
    const isPrivate = detectPrivateBrowsing(req);

    // ===== DETECTAR VPN/PROXY =====
    const vpnInfo = await detectVPN(ipFinal);

    // ===== RESULTADO FINAL =====
    const blocked = isPrivate || vpnInfo.isVPN;

    res.status(200).json({
        success: true,
        data: {
            ip: ipFinal,
            isPrivate: isPrivate,
            vpn: vpnInfo,
            blocked: blocked,
            message: blocked ? '🚫 Acesso bloqueado!' : '✅ Acesso permitido!',
            timestamp: new Date().toISOString()
        }
    });
}

// ============================================================
// FUNÇÃO PARA DETECTAR NAVEGADOR ANÔNIMO (VIA HEADERS E USER-AGENT)
// ============================================================
function detectPrivateBrowsing(req) {
    const headers = req.headers;
    const ua = headers['user-agent'] || '';
    
    // ===== MÉTODO 1: Verificar headers específicos =====
    // Chrome Incognito (algumas extensões enviam)
    if (headers['x-chrome-incognito'] || headers['x-incognito']) {
        return true;
    }
    
    // ===== MÉTODO 2: Verificar User-Agent de navegadores anônimos =====
    // Alguns navegadores anônimos modificam o User-Agent
    const privateBrowsingKeywords = [
        'incognito', 'private', 'anonymous', 'tor', 'brave'
    ];
    
    const uaLower = ua.toLowerCase();
    for (const keyword of privateBrowsingKeywords) {
        if (uaLower.includes(keyword)) {
            return true;
        }
    }
    
    // ===== MÉTODO 3: Verificar headers de segurança =====
    // Navegadores anônimos geralmente tem headers diferentes
    if (headers['sec-fetch-site'] && headers['sec-fetch-mode']) {
        // Verificar se é um navegador comum (não anônimo)
        // Isso é apenas um fallback
    }
    
    // ===== MÉTODO 4: Verificar DNT (Do Not Track) =====
    // Navegadores anônimos geralmente tem DNT ativado
    if (headers['dnt'] === '1') {
        // Isso não é 100% confiável, mas ajuda
        // return true; // Descomente se quiser ativar
    }
    
    // ===== MÉTODO 5: Verificar via JavaScript (cliente) =====
    // Isso é feito no frontend, não no backend
    // O frontend envia um header personalizado se detectar anônimo
    
    // Verificar se o frontend enviou a detecção
    if (headers['x-private-browser'] === 'true') {
        return true;
    }
    
    return false;
}

// ============================================================
// FUNÇÃO PARA DETECTAR VPN (MULTIPLAS APIS)
// ============================================================
async function detectVPN(ip) {
    // Lista de provedores de VPN comuns
    const vpnProviders = [
        'VPN', 'Proxy', 'Hosting', 'Cloud', 'Data Center', 
        'Amazon', 'Google Cloud', 'Microsoft Azure', 'DigitalOcean',
        'NordVPN', 'ExpressVPN', 'Surfshark', 'CyberGhost', 'Private Internet Access',
        'Windscribe', 'ProtonVPN', 'TunnelBear', 'Hotspot Shield',
        'VyprVPN', 'IPVanish', 'PureVPN', 'ZenMate', 'HMA',
        'HideMyAss', 'TorGuard', 'Mullvad', 'IVPN', 'AzireVPN',
        'OVPN', 'AirVPN', 'Perfect Privacy', 'Proxy.sh'
    ];
    
    try {
        // ===== TENTATIVA 1: ip-api.com =====
        const response = await fetchWithTimeout(
            `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,proxy,hosting,query`,
            5000
        );
        
        if (response) {
            const data = await response.json();
            
            if (data.status === 'success') {
                const isProxy = data.proxy === true;
                const isHosting = data.hosting === true;
                
                // Verificar se é provedor de VPN
                const isVPNProvider = vpnProviders.some(provider => 
                    (data.isp && data.isp.toLowerCase().includes(provider.toLowerCase())) || 
                    (data.org && data.org.toLowerCase().includes(provider.toLowerCase()))
                );
                
                const isDatacenter = isHosting || isVPNProvider;
                
                return {
                    isVPN: isProxy || isDatacenter,
                    details: {
                        country: data.country || 'Desconhecido',
                        region: data.regionName || 'Desconhecido',
                        city: data.city || 'Desconhecido',
                        isp: data.isp || 'Desconhecido',
                        org: data.org || 'Desconhecido',
                        isProxy: isProxy,
                        isDatacenter: isDatacenter,
                        provider: data.isp || 'Desconhecido'
                    }
                };
            }
        }
        
        // ===== TENTATIVA 2: ipapi.co =====
        const response2 = await fetchWithTimeout(
            `https://ipapi.co/${ip}/json/`,
            5000
        );
        
        if (response2) {
            const data = await response2.json();
            
            if (data && !data.error) {
                const isProxy = data.proxy === true;
                const isHosting = data.hosting === true;
                
                const isVPNProvider = vpnProviders.some(provider => 
                    (data.org && data.org.toLowerCase().includes(provider.toLowerCase()))
                );
                
                return {
                    isVPN: isProxy || isHosting || isVPNProvider,
                    details: {
                        country: data.country_name || 'Desconhecido',
                        region: data.region || 'Desconhecido',
                        city: data.city || 'Desconhecido',
                        isp: data.org || 'Desconhecido',
                        org: data.org || 'Desconhecido',
                        isProxy: isProxy,
                        isDatacenter: isHosting || isVPNProvider,
                        provider: data.org || 'Desconhecido'
                    }
                };
            }
        }
        
        // ===== TENTATIVA 3: ipinfo.io =====
        const response3 = await fetchWithTimeout(
            `https://ipinfo.io/${ip}/json`,
            5000
        );
        
        if (response3) {
            const data = await response3.json();
            
            if (data && !data.error) {
                const isVPNProvider = vpnProviders.some(provider => 
                    (data.org && data.org.toLowerCase().includes(provider.toLowerCase())) ||
                    (data.hostname && data.hostname.toLowerCase().includes(provider.toLowerCase()))
                );
                
                return {
                    isVPN: isVPNProvider,
                    details: {
                        country: data.country || 'Desconhecido',
                        region: data.region || 'Desconhecido',
                        city: data.city || 'Desconhecido',
                        isp: data.org || 'Desconhecido',
                        org: data.org || 'Desconhecido',
                        isProxy: false,
                        isDatacenter: isVPNProvider,
                        provider: data.org || 'Desconhecido'
                    }
                };
            }
        }
        
        // ===== SE TUDO FALHAR =====
        return {
            isVPN: false,
            details: {
                country: 'Desconhecido',
                region: 'Desconhecido',
                city: 'Desconhecido',
                isp: 'Desconhecido',
                org: 'Desconhecido',
                isProxy: false,
                isDatacenter: false,
                provider: 'Desconhecido'
            },
            error: 'Não foi possível verificar VPN'
        };
        
    } catch (error) {
        console.error('❌ Erro ao detectar VPN:', error);
        return {
            isVPN: false,
            details: {
                country: 'Desconhecido',
                region: 'Desconhecido',
                city: 'Desconhecido',
                isp: 'Desconhecido',
                org: 'Desconhecido',
                isProxy: false,
                isDatacenter: false,
                provider: 'Desconhecido'
            },
            error: 'Erro ao verificar VPN'
        };
    }
}

// ============================================================
// FUNÇÃO PARA FETCH COM TIMEOUT
// ============================================================
async function fetchWithTimeout(url, timeout = 5000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Aurora-Security/1.0'
            }
        });
        
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        console.error(`❌ Timeout/Erro ao buscar ${url}:`, error.message);
        return null;
    }
}
