# Pontua — cabeçalhos de segurança (incluído pelo nginx.conf no server e em cada location que
# define add_header: um add_header dentro de location substitui todos os herdados do server).
#
# Compatível com o Google Identity Services (accounts.google.com):
# - frame-ancestors/X-Frame-Options só impedem que OUTROS sites emoldurem o Pontua; o iframe do
#   botão do Google dentro da página continua permitido.
# - Não há Cross-Origin-Opener-Policy "same-origin" (quebraria o popup do Google).
# - identity-credentials-get (FedCM) liberado para a própria origem e para accounts.google.com.
# - Sem CSP de script-src aqui: a política completa fica para quando houver relatório de violações.

add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=(), browsing-topics=(), identity-credentials-get=(self \"https://accounts.google.com\")" always;
