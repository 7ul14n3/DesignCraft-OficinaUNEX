document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos da UI
    const promptInput = document.getElementById('input-prompt');
    const generateButton = document.getElementById('generate-button');
    const previewBox = document.getElementById('component-preview');
    const codeOutput = document.getElementById('code-output');
    const tabButtons = document.querySelectorAll('.tab-button');
    const archiveButton = document.getElementById('archive-button');
    const archivedContainer = document.getElementById('archived-components');
    const processingStatus = document.getElementById('processing-status');
    const suggestionBox = document.getElementById('suggestion-box');
    const diversitySelect = document.getElementById('diversity-select'); 

    // Estado global
    let generatedCode = { html: '', css: '', js: '' };
    let currentPrompt = '';
    let archivedComponents = JSON.parse(localStorage.getItem('designCraftDocs')) || [];
    let currentDiversity = diversitySelect.value; 

    // Cache para armazenar os diferentes códigos gerados
    let generatedCodeCache = {
        semantic: { html: '', css: '', js: '' },
        utility: { html: '', css: '', js: '' }
    };

    // --- Mapeamento de Cores e Tokens ---
    const colorMap = {
        'default': { colorHex: '#3498db', colorRgba: 'rgba(52, 152, 219, 1)', translucentRgba: 'rgba(52, 152, 219, 0.7)', name: 'azul' },
        'verde': { colorHex: '#3cb371', colorRgba: 'rgba(60, 179, 113, 1)', translucentRgba: 'rgba(60, 179, 113, 0.7)', name: 'verde' },
        'vermelho': { colorHex: '#e74c3c', colorRgba: 'rgba(231, 76, 60, 1)', translucentRgba: 'rgba(231, 76, 60, 0.7)', name: 'vermelho' },
        'cinza': { colorHex: '#95a5a6', colorRgba: 'rgba(149, 165, 166, 1)', translucentRgba: 'rgba(149, 165, 166, 0.7)', name: 'cinza' }
    };
    
    // Palavras-chave para sugestão de busca de IA
    const SUGGESTION_KEYWORDS = [
        "botão flutuante", "botão quadrado", "botão arredondado", "card cinza com sombra",
        "card esquelético", "modal translucido", "menu de navegação vermelho", 
        "card com botão verde", "botão piscando", "menu vertical"
    ];

    // --- Funções de Simulação e Sugestão de IA ---
    const simulateProcessing = async (callback) => {
        generateButton.disabled = true;
        processingStatus.innerHTML = '🤖 Analisando a solicitação<span class="dot-flashing"><span>.</span><span>.</span><span>.</span></span>';

        const delay = Math.random() * 1000 + 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        processingStatus.textContent = '';
        generateButton.disabled = false;
        callback();
    };

    const handleInputSuggestions = () => {
        const input = promptInput.value.toLowerCase().trim();
        suggestionBox.innerHTML = '';
        
        if (input.length < 3) {
            suggestionBox.style.display = 'none';
            return;
        }

        const filteredSuggestions = SUGGESTION_KEYWORDS
            .filter(keyword => keyword.includes(input))
            .slice(0, 5);

        if (filteredSuggestions.length > 0) {
            filteredSuggestions.forEach(suggestion => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = suggestion;
                
                // Ao clicar, o campo é preenchido e o componente é gerado
                item.addEventListener('click', () => {
                    promptInput.value = suggestion;
                    suggestionBox.style.display = 'none';
                    handleGenerate(); 
                });
                
                suggestionBox.appendChild(item);
            });
            suggestionBox.style.display = 'block';
        } else {
            suggestionBox.style.display = 'none';
        }
    };

    // --- FUNÇÕES DE GERAÇÃO CONDICIONAIS (DIVERSIDADE) ---

    // Geração do CSS Puro/Semântico para Botões
    const getSemanticButtonCSS = (tokens, primaryColor, buttonShapeClass, isSoftRounded) => {
        return `
/* Design Tokens */
:root { --dc-primary-color: ${primaryColor.colorRgba}; --dc-translucent-color: ${primaryColor.translucentRgba}; }

.dc-button-base {
    border: none; color: white; font-weight: bold; cursor: pointer;
    display: flex; justify-content: center; align-items: center;
    transition: all 0.3s ease-in-out; 
    background-color: var(--dc-primary-color);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.dc-button-fab { width: 80px; height: 80px; border-radius: 50%; }
${tokens.isSquare && tokens.isFloating ? `.dc-button-fab { border-radius: 8px; }` : ''}

.dc-button-normal {
    width: auto; min-width: 150px; padding: 10px 25px; height: 40px; 
    border-radius: ${isSoftRounded ? '20px' : (tokens.isSquare ? '0' : '5px')}; 
    font-size: 1rem;
}

${tokens.isFloating ? `.dc-wrapper-floating { position: absolute; bottom: 30px; right: 30px; z-index: 99; }
.dc-wrapper-normal { margin: 20px auto; }` : ''}

${tokens.isTranslucent ? `.dc-button-base { background-color: var(--dc-translucent-color); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }` : ''}

${tokens.isVertical ? `.dc-text-rotator { display: inline-block; transform: rotate(90deg); white-space: nowrap; font-size: 0.9em; }` : ''}

${tokens.isFlashing ? `
@keyframes pulse-blink {
    0%, 100% { box-shadow: 0 0 0 0 ${primaryColor.translucentRgba}; opacity: 1; }
    50% { box-shadow: 0 0 0 15px rgba(52, 152, 219, 0); opacity: 0.8; }
}
.dc-button-base { animation: pulse-blink 2s infinite cubic-bezier(0.66, 0, 0, 1); }
` : ''}
.dc-button-base:hover { transform: scale(1.05); background-color: ${primaryColor.colorHex}; animation-play-state: paused; }
        `.trim();
    };

    // Geração do CSS Utilitário (Tailwind-like) para Botões
    const getUtilityButtonCSS = (tokens, primaryColor) => {
        const bgColorClass = `bg-[${primaryColor.colorHex}]`;
        const hoverClass = `hover:bg-[${primaryColor.colorHex}DD]`;
        const shadowClass = tokens.hasShadow ? 'shadow-lg' : '';
        
        let sizeClasses = 'w-40 h-10 px-6 py-2';
        let roundedClasses = 'rounded-md';

        if (tokens.isFloating) {
            sizeClasses = 'w-20 h-20';
            roundedClasses = tokens.isSquare ? 'rounded-lg' : 'rounded-full';
        } else if (tokens.isRounded) {
            roundedClasses = 'rounded-full'; 
        } else if (tokens.isSquare) {
            roundedClasses = 'rounded-none'; 
        }

        const utilityClasses = `text-white font-bold transition duration-300 ease-in-out ${bgColorClass} ${hoverClass} ${shadowClass} ${sizeClasses} ${roundedClasses}`;

        return `
/* 💡 Diversidade de Código: Estilo Utilitário (Tailwind-like) 
 * O HTML deve ser ajustado para usar as classes diretamente.
 * EXEMPLO DE HTML (utility):
 * <button class="${utilityClasses}">...</button>
*/

.btn-utility {
    ${utilityClasses.split(' ').map(cls => {
        if (cls.startsWith('bg-')) return `  background-color: ${primaryColor.colorHex};`;
        if (cls.startsWith('hover:')) return `  /* Simulação de Hover */`;
        if (cls.startsWith('shadow-')) return `  box-shadow: 0 10px 15px rgba(0,0,0,0.1);`;
        if (cls.includes('rounded-full')) return `  border-radius: 9999px;`;
        if (cls.includes('rounded-lg')) return `  border-radius: 8px;`;
        if (cls.includes('rounded-none')) return `  border-radius: 0;`;
        if (cls.includes('w-20')) return `  width: 80px; height: 80px;`;
        return '';
    }).filter(line => line.length > 0).join('\n').trim()}
    /* Estilos base para exibição */
    color: white;
    cursor: pointer;
    display: flex; justify-content: center; align-items: center;
    transition: all 0.3s;
}

/* O resto dos estilos (posicionamento, animação) seria injetado no HTML via classes utilitárias de Tailwind */
        `.trim();
    };


    // --- Geração de Componentes (Armazena no Cache) ---

    // Geração Específica para Botões
    const generateButtonComponent = (tokens, primaryColor) => {
        const buttonShapeClass = (tokens.isSquare || !tokens.isFloating) ? 'dc-button-normal' : 'dc-button-fab';
        const isSoftRounded = !tokens.isSquare && tokens.isRounded && !tokens.isFloating;

        const baseHtml = `
<div class="dc-wrapper ${tokens.isFloating ? 'dc-wrapper-floating' : 'dc-wrapper-normal'}">
    <button id="dc-generated-component" class="dc-button-base ${buttonShapeClass}" aria-label="${tokens.text}">
        <span class="${tokens.isVertical ? 'dc-text-rotator' : ''}">${tokens.text.toUpperCase()}</span>
    </button>
</div>
        `.trim();

        generatedCodeCache.semantic.html = baseHtml;
        generatedCodeCache.semantic.css = getSemanticButtonCSS(tokens, primaryColor, buttonShapeClass, isSoftRounded);
        generatedCodeCache.semantic.js = '// Código JS para botão não necessário.';

        generatedCodeCache.utility.html = baseHtml; // HTML base é o mesmo para o Preview
        generatedCodeCache.utility.css = getUtilityButtonCSS(tokens, primaryColor);
        generatedCodeCache.utility.js = '// Código JS para botão não necessário.';
    };

    // Geração Composta: Card com Botão Secundário 
    const generateCompositeCard = (tokens, cardColor, buttonColor) => {
        const html = `
<div class="dc-card-wrapper">
    <div id="dc-generated-component" class="dc-card-base ${tokens.hasShadow ? 'dc-shadow' : ''}">
        <div class="dc-card-header" style="background-color:${cardColor.colorHex};"></div>
        <h4>${tokens.contentTitle.toUpperCase()}</h4>
        <p>Card principal ${cardColor.name} com um botão de ação ${buttonColor.name}.</p>
        <button class="dc-card-action-btn dc-secondary-btn" data-color="${buttonColor.name}">
            ${tokens.text.toUpperCase()}
        </button>
    </div>
</div>
        `.trim();

        const css = `
/* Design Tokens */
:root { 
    --dc-card-color: ${cardColor.colorHex};
    --dc-secondary-btn-color: ${buttonColor.colorHex}; 
}

.dc-card-wrapper { max-width: 300px; margin: 20px auto; width: 100%; }
.dc-card-base {
    background: #ffffff; border-radius: 10px; overflow: hidden;
    transition: transform 0.3s ease; border: 1px solid #eee;
}
.dc-shadow { box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1); }
.dc-card-header { height: 100px; background-color: var(--dc-card-color); }
.dc-card-base h4 { padding: 15px 20px 5px; color: var(--dc-card-color); }
.dc-card-base p { padding: 0 20px 15px; font-size: 0.9em; color: #555; }

/* Estilo do Botão Secundário (Composição) */
.dc-card-action-btn { 
    width: calc(100% - 40px); margin: 0 20px 20px; padding: 10px;
    color: white; border: none; border-radius: 5px; cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s;
}

.dc-secondary-btn {
    background-color: var(--dc-secondary-btn-color);
}
.dc-secondary-btn:hover {
    filter: brightness(0.9);
}
        `.trim();
        
        generatedCodeCache.semantic = { html, css, js: '// Código JS para card composto não necessário.' };
        generatedCodeCache.utility = { html, css: '// Diversidade não implementada para Card Composto.', js: '// Código JS para card composto não necessário.' };
    };

    // Geração Simples: Card 
    const generateCardComponent = (tokens, primaryColor) => {
        const html = `
<div class="dc-card-wrapper">
    <div id="dc-generated-component" class="dc-card-base ${tokens.hasShadow ? 'dc-shadow' : ''} ${tokens.isSkeleton ? 'dc-skeleton' : ''}">
        <div class="dc-card-header" style="background-color:${primaryColor.colorHex};"></div>
        <h4>${tokens.contentTitle.toUpperCase()}</h4>
        <p>Este é um parágrafo de conteúdo simulado. O card gerado é totalmente responsivo.</p>
        <button class="dc-card-action-btn" style="background-color:${primaryColor.colorHex};">Ver Detalhes</button>
    </div>
</div>
        `.trim();

        const css = `
/* Design Tokens */
:root { --dc-primary-color: ${primaryColor.colorRgba}; }

.dc-card-wrapper { max-width: 300px; margin: 20px auto; width: 100%; }

.dc-card-base {
    background: #ffffff; border-radius: 10px; overflow: hidden;
    transition: transform 0.3s ease; border: 1px solid #eee;
}

.dc-shadow { box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1); }
.dc-card-header { height: 100px; background-color: ${primaryColor.colorHex}; }
.dc-card-base h4 { padding: 15px 20px 5px; color: ${primaryColor.colorHex}; }
.dc-card-base p { padding: 0 20px 15px; font-size: 0.9em; color: #555; }

.dc-card-action-btn { width: calc(100% - 40px); margin: 0 20px 20px; padding: 10px; color: white; border: none; border-radius: 5px; cursor: pointer; }

${tokens.isSkeleton ? `
@keyframes loading-pulse { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
.dc-card-header, .dc-card-base h4, .dc-card-base p {
    background-color: #f0f0f0;
    background-image: linear-gradient(90deg, #f0f0f0 0px, #fafafa 40px, #f0f0f0 80px);
    background-size: 200px 100%;
    animation: loading-pulse 1.5s infinite linear;
}
.dc-card-header { height: 100px; }
.dc-card-base h4 { color: transparent; height: 20px; width: 80%; }
.dc-card-base p { color: transparent; height: 15px; width: 90%; margin: 0 20px 15px; }
.dc-card-action-btn { display: none; }
` : ``}

.dc-card-base:hover { transform: translateY(-5px); }
        `.trim();
        
        generatedCodeCache.semantic = { html, css, js: '// Código JS para card não necessário.' };
        generatedCodeCache.utility = { html, css: '// Diversidade não implementada para Card Simples.', js: '// Código JS para card não necessário.' };
    };
    
    // Geração Simples: Modal 
    const generateModalComponent = (tokens, primaryColor) => {
        const html = `
<div id="dc-generated-component" class="dc-modal-overlay">
    <div class="dc-modal-content ${tokens.isTranslucent ? 'dc-translucent-modal' : ''}">
        <div class="dc-modal-header" style="background-color:${primaryColor.colorHex};">
            <h5>${tokens.contentTitle || 'Título do Modal'}</h5>
            <button class="dc-close-btn">&times;</button>
        </div>
        <div class="dc-modal-body">
            <p>Este é um pop-up para exibir informações importantes.</p>
        </div>
    </div>
</div>
        `.trim();
        
        const css = `
.dc-modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.dc-modal-content {
    background-color: #fff; border-radius: 10px; width: 90%; max-width: 500px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3); overflow: hidden;
}
.dc-translucent-modal {
    background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.dc-modal-header {
    padding: 15px; color: white; display: flex; justify-content: space-between; align-items: center;
}
.dc-close-btn { background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; }
.dc-modal-body { padding: 20px; }
        `.trim();

        const js = `
// Código JS para fechar o Modal
document.addEventListener('click', (e) => {
    if (e.target.matches('.dc-close-btn') || e.target.matches('.dc-modal-overlay')) {
        const modal = document.getElementById('dc-generated-component');
        if (modal) modal.style.display = 'none';
    }
});
        `.trim();

        generatedCodeCache.semantic = { html, css, js };
        generatedCodeCache.utility = { html, css: '// Diversidade não implementada para Modal.', js };
    };

    // Geração Simples: Menu de Navegação 
    const generateNavComponent = (tokens, primaryColor) => {
        const html = `
<nav id="dc-generated-component" class="dc-nav-base" style="background-color:${primaryColor.colorHex};">
    <a href="#" class="dc-nav-brand">DesignCraft</a>
    <div class="dc-nav-links">
        <a href="#home">Home</a>
        <a href="#about">Sobre</a>
        <a href="#services">Serviços</a>
        <a href="#contact">Contato</a>
    </div>
</nav>
        `.trim();

        const css = `
.dc-nav-base {
    display: flex; justify-content: space-between; align-items: center;
    padding: 15px 30px; color: white; width: 100%;
}
.dc-nav-brand { font-size: 1.5rem; font-weight: bold; color: white; text-decoration: none; }
.dc-nav-links a {
    color: white; text-decoration: none; margin-left: 20px;
    padding: 5px 10px; border-radius: 4px; transition: background-color 0.3s;
}
.dc-nav-links a:hover { background-color: rgba(255, 255, 255, 0.2); }
        `.trim();

        generatedCodeCache.semantic = { html, css, js: '// Código JS para menu de navegação não necessário.' };
        generatedCodeCache.utility = { html, css: '// Diversidade não implementada para Navegação.', js: '// Código JS para menu de navegação não necessário.' };
    };

    // --- Lógica Principal de Interpretação e Geração ---
    const generateComponentLogic = () => {
        const prompt = promptInput.value.toLowerCase();
        currentPrompt = prompt;
        suggestionBox.style.display = 'none';
        
        // 1. ANÁLISE COMPLETA DE TOKENS (Corrigida)
        const tokens = {
            isButton: prompt.includes('botão') || prompt.includes('button'),
            isCard: prompt.includes('card') || prompt.includes('cartão') || prompt.includes('perfil'),
            isModal: prompt.includes('modal') || prompt.includes('janela popup') || prompt.includes('popup'),
            isNav: prompt.includes('menu') || prompt.includes('navegação'),
            
            color: prompt.includes('verde') ? 'verde' : prompt.includes('azul') ? 'azul' : prompt.includes('vermelho') ? 'vermelho' : 'default',
            isFloating: prompt.includes('flutuante') || prompt.includes('fixo'),
            isTranslucent: prompt.includes('translucido') || prompt.includes('vidro'),
            isVertical: prompt.includes('vertical'),
            isFlashing: prompt.includes('piscando') || prompt.includes('pulsando'),
            hasShadow: prompt.includes('sombra') || prompt.includes('elevação'),
            isRounded: prompt.includes('arredondado') || prompt.includes('circular'),
            isSquare: prompt.includes('quadrado') || prompt.includes('retangular'), 
            isSkeleton: prompt.includes('esquelético') || prompt.includes('skeleton'),
            
            text: (prompt.match(/"([^"]*)"/) || [null, 'Ação'])[1],
            contentTitle: (prompt.match(/título "([^"]*)"/) || [null, 'Título Padrão'])[1]
        };
        const primaryColor = colorMap[tokens.color];
        
        // 2. Geração (Armazena no Cache)
        if (tokens.isCard) {
            const secondaryColorKey = prompt.includes('botão') && prompt.includes('vermelho') ? 'vermelho' : 
                                      prompt.includes('botão') && prompt.includes('verde') ? 'verde' : null;
            
            if (secondaryColorKey && secondaryColorKey !== tokens.color) {
                generateCompositeCard(tokens, primaryColor, colorMap[secondaryColorKey]);
            } else {
                generateCardComponent(tokens, primaryColor);
            }
        } else if (tokens.isButton) {
            generateButtonComponent(tokens, primaryColor);
        } else if (tokens.isModal) {
            generateModalComponent(tokens, primaryColor);
        } else if (tokens.isNav) {
            generateNavComponent(tokens, primaryColor);
        } else {
            // Lógica de Erro
            generatedCodeCache.semantic = { html: `<p style="color:red; text-align:center; padding: 20px;">Não reconhecemos este componente. Tente ser mais explícito (Ex: "Card com botão vermelho")</p>`, css: '', js: '' };
            generatedCodeCache.utility = { html: `<p style="color:red; text-align:center; padding: 20px;">Não reconhecemos este componente.</p>`, css: '', js: '' };
        }

        // 3. Renderiza e Exibe
        updateCodeDisplay(); // Renderiza o código correto com base no seletor de diversidade
        // O preview usa o CSS Semântico para a renderização, pois o Utilitário não é real
        previewBox.innerHTML = `<style>${generatedCodeCache.semantic.css}</style>${generatedCodeCache.semantic.html}`;
        showCode(document.querySelector('.tab-button.active').dataset.lang);
    };

    const updateCodeDisplay = () => {
        currentDiversity = diversitySelect.value;
        const currentLang = document.querySelector('.tab-button.active').dataset.lang;
        
        // Atualiza o objeto generatedCode com o código do cache selecionado
        generatedCode.html = generatedCodeCache[currentDiversity].html;
        generatedCode.css = generatedCodeCache[currentDiversity].css;
        generatedCode.js = generatedCodeCache[currentDiversity].js;

        // Recarrega o painel de código
        showCode(currentLang);
    };

    // --- Handlers de Ação ---
    const handleGenerate = () => {
        simulateProcessing(generateComponentLogic);
    };

    // --- Funções de UI, Arquivamento e Navegação ---
    const showCode = (language) => {
        const langMap = { html: 'markup', css: 'css', js: 'javascript' };
        codeOutput.innerHTML = `<code class="language-${langMap[language]}">${generatedCode[language] || '// Nenhum código gerado para este tipo.'}</code>`;

        tabButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-button[data-lang="${language}"]`).classList.add('active');
    };

    const archiveComponent = () => {
        const componentToArchive = {
            id: Date.now(),
            prompt: currentPrompt,
            codes: generatedCodeCache.semantic, // Arquiva sempre o código semântico/puro
            date: new Date().toLocaleDateString('pt-BR')
        };
        archivedComponents.push(componentToArchive);
        localStorage.setItem('designCraftDocs', JSON.stringify(archivedComponents));
        renderArchivedComponents();
        alert('Componente arquivado com sucesso!');
    };

    const renderArchivedComponents = () => {
        if (archivedComponents.length === 0) {
            archivedContainer.innerHTML = '<p class="placeholder-text">Nenhum componente arquivado ainda.</p>';
            return;
        }

        archivedContainer.innerHTML = archivedComponents.map(comp => `
            <div class="archived-card">
                <h4>${comp.prompt}</h4>
                <p>Arquivado em: ${comp.date}</p>
                <button class="view-code-btn" data-id="${comp.id}" data-lang="html">Ver HTML</button>
                <button class="view-code-btn" data-id="${comp.id}" data-lang="css">Ver CSS</button>
                <button class="view-code-btn" data-id="${comp.id}" data-lang="js">Ver JS</button>
                <pre class="code-display" id="archived-code-${comp.id}" style="display:none;"></pre>
            </div>
        `).join('');

        archivedContainer.querySelectorAll('.view-code-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                const lang = e.target.dataset.lang;
                const card = archivedComponents.find(c => c.id === id);
                const codeBlock = document.getElementById(`archived-code-${id}`);
                const langMap = { html: 'markup', css: 'css', js: 'javascript' };

                if (codeBlock.style.display === 'block' && codeBlock.dataset.lang === lang) {
                    codeBlock.style.display = 'none';
                } else {
                    codeBlock.innerHTML = `<code class="language-${langMap[lang]}">${card.codes[lang]}</code>`;
                    codeBlock.style.display = 'block';
                    codeBlock.dataset.lang = lang;
                }
            });
        });
    };

    const handleHashChange = () => {
        const hash = window.location.hash || '#studio';
        document.querySelectorAll('main, section').forEach(section => {
            if (section.id && section.id === hash.substring(1)) {
                section.style.display = 'block';
            } else if (section.id && section.classList.contains('doc-section')) {
                section.style.display = 'none';
            }
        });
    };

    // Event Listeners
    generateButton.addEventListener('click', handleGenerate);
    archiveButton.addEventListener('click', archiveComponent);
    diversitySelect.addEventListener('change', updateCodeDisplay);
    promptInput.addEventListener('input', handleInputSuggestions);
    window.addEventListener('hashchange', handleHashChange);
    tabButtons.forEach(button => {
        button.addEventListener('click', () => { showCode(button.dataset.lang); });
    });
    
    // Esconde a caixa de sugestão ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-box-wrapper')) {
            suggestionBox.style.display = 'none';
        }
    });

    // Inicialização do Site
    promptInput.value = 'botão flutuante quadrado verde piscando'; 
    handleGenerate();
    handleHashChange();
    renderArchivedComponents();
});