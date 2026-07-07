import fs from 'fs';
import path from 'path';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const BAN_FILE = path.join(process.cwd(), 'api/ban/banned-ips.json');

// GIF PADRÃO
const DEFAULT_GIF = 'https://media.tenor.com/2BpR9fW5HWQAAAAC/roblox-ban.gif';

// ============================================================
// FUNÇÕES DO BANCO DE DADOS
// ============================================================

function getBannedIPs() {
    try {
        if (!fs.existsSync(BAN_FILE)) {
            const defaultData = { 
                banned: [],
                metadata: {
                    lastUpdated: new Date().toISOString(),
                    totalBans: 0,
                    activeBans: 0,
                    expiredBans: 0
                }
            };
            fs.writeFileSync(BAN_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(BAN_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Erro ao ler arquivo de ban:', error);
        return { banned: [] };
    }
}

function saveBannedIPs(data) {
    try {
        // Atualizar metadata
        const now = new Date().toISOString();
        const active = data.banned.filter(b => !b.expires || new Date(b.expires) > new Date());
        const expired = data.banned.filter(b => b.expires && new Date(b.expires) <= new Date());
        
        data.metadata = {
            lastUpdated: now,
            totalBans: data.banned.length,
            activeBans: active.length,
            expiredBans: expired.length
        };
        
        fs.writeFileSync(BAN_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Erro ao salvar arquivo de ban:', error);
        return false;
    }
}

function isIPBanned(ip, bannedList) {
    return bannedList.find(ban => ban.ip === ip);
}

function isBanExpired(ban) {
    if (!ban.expires) return false;
    return new Date(ban.expires) <= new Date();
}

function cleanExpiredBans(data) {
    const initialLength = data.banned.length;
    data.banned = data.banned.filter(ban => !isBanExpired(ban));
    const removed = initialLength - data.banned.length;
    if (removed > 0) {
        saveBannedIPs(data);
        console.log(`🧹 ${removed} bans expirados removidos`);
    }
    return data;
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function isValidIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

function isValidGifUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function getBanDuration(expires) {
    if (!expires) return 'Permanente';
    const diff = new Date(expires) - new Date();
    if (diff <= 0) return 'Expirado';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
}

// ============================================================
// API HANDLER
// ============================================================

export default async function handler(req, res) {
    // ===== CORS =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    let data = getBannedIPs();
    data = cleanExpiredBans(data);

    const { method } = req;

    // ============================================================
    // GET - Verificar / Listar bans
    // ============================================================
    if (method === 'GET') {
        // === Verificar IP específico ===
        if (req.query.check) {
            const ip = req.query.check;
            
            if (!isValidIP(ip)) {
                return res.status(400).json({ 
                    error: 'IP inválido' 
                });
            }

            const banned = isIPBanned(ip, data.banned);
            
            if (banned) {
                // VERIFICA SE EXPIRou
                if (isBanExpired(banned)) {
                    // Remove automaticamente
                    data.banned = data.banned.filter(b => b.ip !== ip);
                    saveBannedIPs(data);
                    return res.status(200).json({ 
                        banned: false,
                        message: 'Ban expirado e removido automaticamente'
                    });
                }

                return res.status(200).json({
                    banned: true,
                    reason: banned.reason,
                    gif: banned.gif || DEFAULT_GIF,
                    expires: banned.expires,
                    date: banned.date,
                    duration: getBanDuration(banned.expires)
                });
            }
            return res.status(200).json({ banned: false });
        }

        // === Listar todos os bans ===
        if (req.query.list === 'all') {
            return res.status(200).json({
                success: true,
                ...data
            });
        }

        // === Listar apenas bans ativos ===
        if (req.query.list === 'active') {
            const active = data.banned.filter(b => !isBanExpired(b));
            return res.status(200).json({
                success: true,
                total: active.length,
                banned: active
            });
        }

        // === Listar apenas bans expirados ===
        if (req.query.list === 'expired') {
            const expired = data.banned.filter(b => isBanExpired(b));
            return res.status(200).json({
                success: true,
                total: expired.length,
                banned: expired
            });
        }

        // === Buscar por motivo ===
        if (req.query.search) {
            const search = req.query.search.toLowerCase();
            const results = data.banned.filter(b => 
                b.reason.toLowerCase().includes(search) ||
                b.ip.includes(search)
            );
            return res.status(200).json({
                success: true,
                total: results.length,
                banned: results
            });
        }

        // === Estatísticas ===
        if (req.query.stats === 'true') {
            const active = data.banned.filter(b => !isBanExpired(b));
            const expired = data.banned.filter(b => isBanExpired(b));
            
            return res.status(200).json({
                success: true,
                stats: {
                    total: data.banned.length,
                    active: active.length,
                    expired: expired.length,
                    permanent: data.banned.filter(b => !b.expires).length,
                    temporary: data.banned.filter(b => b.expires).length,
                    lastUpdated: data.metadata?.lastUpdated || new Date().toISOString()
                }
            });
        }

        // === GET padrão - resumo ===
        return res.status(200).json({
            success: true,
            total: data.banned.length,
            banned: data.banned.map(b => ({
                ip: b.ip,
                reason: b.reason,
                gif: b.gif || DEFAULT_GIF,
                expires: b.expires,
                date: b.date,
                duration: getBanDuration(b.expires),
                expired: isBanExpired(b)
            }))
        });
    }

    // ============================================================
    // POST - Adicionar ban
    // ============================================================
    if (method === 'POST') {
        const { ip, reason, expires, gif } = req.body;

        if (!ip) {
            return res.status(400).json({ 
                success: false,
                error: 'IP é obrigatório' 
            });
        }

        if (!isValidIP(ip)) {
            return res.status(400).json({ 
                success: false,
                error: 'IP inválido' 
            });
        }

        // Validar GIF se foi enviado
        if (gif && !isValidGifUrl(gif)) {
            return res.status(400).json({
                success: false,
                error: 'URL do GIF inválida'
            });
        }

        // Verificar se IP já está banido
        const existing = isIPBanned(ip, data.banned);
        if (existing) {
            if (isBanExpired(existing)) {
                // Remove se expirou
                data.banned = data.banned.filter(b => b.ip !== ip);
            } else {
                return res.status(400).json({ 
                    success: false,
                    error: 'IP já está banido',
                    ban: existing
                });
            }
        }

        // Criar novo ban
        const newBan = {
            ip,
            reason: reason || 'Uso indevido do sistema',
            gif: gif || DEFAULT_GIF,
            date: new Date().toISOString(),
            expires: expires || null
        };

        data.banned.push(newBan);

        if (saveBannedIPs(data)) {
            return res.status(201).json({
                success: true,
                message: 'IP banido com sucesso',
                ban: newBan
            });
        }

        return res.status(500).json({ 
            success: false,
            error: 'Erro ao salvar ban' 
        });
    }

    // ============================================================
    // PUT - Atualizar ban
    // ============================================================
    if (method === 'PUT') {
        const { ip, reason, expires, gif } = req.body;

        if (!ip) {
            return res.status(400).json({ 
                success: false,
                error: 'IP é obrigatório' 
            });
        }

        if (!isValidIP(ip)) {
            return res.status(400).json({ 
                success: false,
                error: 'IP inválido' 
            });
        }

        const index = data.banned.findIndex(b => b.ip === ip);
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'IP não encontrado na lista de banidos' 
            });
        }

        // Atualizar campos
        if (reason) data.banned[index].reason = reason;
        if (expires !== undefined) data.banned[index].expires = expires;
        if (gif) {
            if (!isValidGifUrl(gif)) {
                return res.status(400).json({
                    success: false,
                    error: 'URL do GIF inválida'
                });
            }
            data.banned[index].gif = gif;
        }
        data.banned[index].updatedAt = new Date().toISOString();

        if (saveBannedIPs(data)) {
            return res.status(200).json({
                success: true,
                message: 'Ban atualizado com sucesso',
                ban: data.banned[index]
            });
        }

        return res.status(500).json({ 
            success: false,
            error: 'Erro ao atualizar ban' 
        });
    }

    // ============================================================
    // DELETE - Remover ban
    // ============================================================
    if (method === 'DELETE') {
        const { ip } = req.body || req.query;

        if (!ip) {
            return res.status(400).json({ 
                success: false,
                error: 'IP é obrigatório' 
            });
        }

        if (!isValidIP(ip)) {
            return res.status(400).json({ 
                success: false,
                error: 'IP inválido' 
            });
        }

        const index = data.banned.findIndex(b => b.ip === ip);

        if (index === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'IP não encontrado na lista de banidos' 
            });
        }

        const removed = data.banned[index];
        data.banned.splice(index, 1);

        if (saveBannedIPs(data)) {
            return res.status(200).json({
                success: true,
                message: 'Ban removido com sucesso',
                removed: removed
            });
        }

        return res.status(500).json({ 
            success: false,
            error: 'Erro ao remover ban' 
        });
    }

    // ============================================================
    // Método não permitido
    // ============================================================
    return res.status(405).json({ 
        success: false,
        error: 'Método não permitido' 
    });
}