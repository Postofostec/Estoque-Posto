// DECLARAÇÃO ÚNICA - Se houver outra linha igual a essa no arquivo, o erro volta.
let produtos = []; 

document.addEventListener('DOMContentLoaded', function () {
    const csvInput = document.getElementById('csvInput');
    const txtBusca = document.getElementById('txtBusca');
    const btnExportar = document.getElementById('btnExportar');

    // Listener para o arquivo
    if(csvInput) {
        csvInput.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                produtos = parseCSV(e.target.result);
                renderizar(produtos);
            };
            reader.readAsText(file);
        });
    }

    // Busca em tempo real
txtBusca.addEventListener('input', function() {
    const termo = this.value.toLowerCase();
    const filtrados = produtos.filter(p => 
        p.nome.toLowerCase().includes(termo) || 
        p.barra.includes(termo) // Agora busca pelos 4 dígitos também
    );
    renderizar(filtrados);
});
// Adicione isso logo após os outros listeners (txtBusca, etc)
const btnReset = document.getElementById('btnReset');

if (btnReset) {
    btnReset.onclick = function() {
        if (confirm("Deseja apagar toda a contagem e começar do zero?")) {
            localStorage.removeItem('estoque_salvo'); // Limpa a memória
            produtos = []; // Limpa a lista
            document.getElementById('lista').innerHTML = ''; // Limpa a tela
            const csvInput = document.getElementById('csvInput');
            if (csvInput) csvInput.value = ''; // Reseta o campo de arquivo
            alert("Sistema limpo para nova importação.");
        }
    };
}

    // Filtros de Categoria
    const ids = ['btnOleo', 'btnFiltro', 'btnVitrine'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.onclick = () => {
                const cat = id.replace('btn', '').replace('Oleo', 'Óleo');
                const filtrados = produtos.filter(p => p.categoria === cat);
                renderizar(filtrados);
            };
        }
    });

    if(btnExportar) btnExportar.onclick = gerarPDF;
});

function parseCSV(texto) {
    const linhas = texto.split('\n').filter(l => l.trim() !== '');
    const lista = [];
    const separador = ';'; 
    
    const cabecalho = linhas[0].split(separador).map(c => c.trim().toLowerCase());
    const idxNome = cabecalho.indexOf('des_item');
    const idxSaldo = cabecalho.indexOf('qtd_saldo');
    const idxBarra = cabecalho.indexOf('cod_barra');

    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(separador);
        if (colunas.length < 2) continue;

        const nome = colunas[idxNome] || "Sem Nome";
        const barraCompleta = colunas[idxBarra] || "";
        const barraFinal = barraCompleta.length >= 4 ? barraCompleta.slice(-4) : barraCompleta;
        let saldoLimpo = colunas[idxSaldo]?.replace(/\./g, '').replace(',', '.') || "0";
        const saldo = parseFloat(saldoLimpo);

        lista.push({ 
            nome: nome,
            barra:barraFinal,
            saldo: parseFloat(saldoLimpo) || 0,
            categoria: identificarCategoria(nome), 
            contagem: null 
        });
    }
    return lista;
}

function identificarCategoria(nome) {
    const n = nome.toLowerCase(); // Tudo vira minúsculo aqui
    
    const keywordsOleo = [
        'oil','fluido','aditivo','unilit','petronas','ipiranga','lubrax',
        'shell','castrol','ypf','texaco','havoline','bardahl','radiex',
        'elaion','agro','zz','selenia','5w30','15w40','20w50','lubri','extron','deiton',
        'evora','lynix','top auto'
    ];

    const keywordsFiltro = [
        'filtro', 'fitro', 'filtrante', 'elemento', 'psl', 'tecfil', 'vox', 'fram',
    ];

    // Agora a comparação funciona porque as chaves acima estão em minúsculo
    if (keywordsFiltro.some(key => n.includes(key))) return 'Filtro';
    if (keywordsOleo.some(key => n.includes(key))) return 'Óleo';
    
    return 'Vitrine';
}

function renderizar(lista) {
    const listaEl = document.getElementById('lista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    lista.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'produto-card';
        
        // Criamos um ID único para a diferença deste produto
        const idDiff = `diff-${index}`;
        const valorContado = p.contagem === null ? '' : p.contagem;
        
    card.innerHTML = `
            <div class="produto-info">
                <span class="produto-nome">
                    <small style="color: #fca311;">[${p.barra}]</small> ${p.nome}
                </span>
                <small>Sistema: <strong>${p.saldo.toFixed(2)}</strong></small>
            </div>
            <div class="produto-acoes">
                <input type="number" step="0.01" 
                       placeholder="Qtd" 
                       class="input-contagem" 
                       value="${valorContado}"
                       oninput="atualizarValor('${p.nome.replace(/'/g, "\\'")}', this.value, '${idDiff}')">
                <span id="${idDiff}" class="diff-badge">Dif: --</span>
            </div>
        `;
        listaEl.appendChild(card);
    });
}

function atualizarValor(nome, valor, idCampo) {
    // Encontra o produto no array principal
    const p = produtos.find(item => item.nome === nome);
    if (p) {
        // Converte o valor digitado
        p.contagem = valor === "" ? null : parseFloat(valor);
        
        // Encontra o elemento da diferença na tela
        const diffEl = document.getElementById(idCampo);
        if (diffEl) {
            if (p.contagem === null) {
                diffEl.innerText = "Dif: --";
                diffEl.style.color = "#666";
            } else {
                const d = p.contagem - p.saldo;
                diffEl.innerText = "Dif: " + d.toFixed(2);
                // Vermelho para falta, Verde para sobra, Cinza para igual
                diffEl.style.color = d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666');
            }
        }
    }
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // FILTRO CRÍTICO: Somente itens contados ONDE a diferença não é ZERO
    const dadosDivergentes = produtos
        .filter(p => p.contagem !== null) // Foi contado
        .map(p => {
            const dif = (p.contagem - p.saldo).toFixed(2);
            return { ...p, dif: parseFloat(dif) };
        })
        .filter(p => p.dif !== 0) // Diferença é positiva ou negativa (não zerada)
        .map(p => [
            `[${p.barra}] ${p.nome}`, 
            p.saldo.toFixed(2), 
            p.contagem.toFixed(2), 
            p.dif.toFixed(2)
        ]);

    if (dadosDivergentes.length === 0) {
        alert("Nenhuma divergência encontrada nos itens contados!");
        return;
    }

    doc.setFontSize(16);
    doc.text("Relatório de Divergências de Estoque", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);

    doc.autoTable({
        head: [['Cód/Produto', 'Sistema', 'Real', 'Dif.']],
        body: dadosDivergentes,
        startY: 30,
        headStyles: { fillColor: [214, 40, 40] }, // Vermelho para indicar alerta/ajuste
        columnStyles: { 0: { cellWidth: 100 } } // Dá mais espaço para o nome
    });

    doc.save(`divergencias-${new Date().toLocaleDateString()}.pdf`);
}