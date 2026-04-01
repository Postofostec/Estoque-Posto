if (sessionStorage.getItem('logado') !== 'true') {
    window.location.href = 'login.html';
}

let produtos = [];

document.addEventListener('DOMContentLoaded', function () {
    const csvNuvem = localStorage.getItem('csv_nuvem');
    const salvo = localStorage.getItem('estoque_salvo');

    if (salvo) {
        produtos = JSON.parse(salvo);
        renderizar(produtos);
    } else if (csvNuvem) {
        produtos = parseCSV(csvNuvem);
        localStorage.setItem('estoque_salvo', JSON.stringify(produtos));
        renderizar(produtos);
    }
    
    // Configuração dos botões e busca (Mantenha suas funções de renderizar e exportar)
    configurarEventos();
});

function parseCSV(texto) {
    const linhas = texto.split('\n').filter(l => l.trim() !== '');
    const lista = [];
    // O Linx geralmente usa ponto e vírgula
    const separador = texto.includes(';') ? ';' : ','; 
    
    const cabecalho = linhas[0].split(separador).map(c => c.trim().toLowerCase());
    
    const idxNome = cabecalho.indexOf('des_item');
    const idxSaldo = cabecalho.indexOf('qtd_saldo');
    const idxBarra = cabecalho.indexOf('cod_barra');

    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(separador);
        if (colunas.length < 2) continue;

        lista.push({ 
            nome: colunas[idxNome] || "Sem Nome",
            barra: (colunas[idxBarra] || "").slice(-4),
            saldo: parseFloat(colunas[idxSaldo]?.replace(',', '.')) || 0,
            categoria: 'Vitrine', // Simplificado para teste
            contagem: null 
        });
    }
    return lista;
}

// ... restante das suas funções de renderizar() e gerarPDF()
function identificarCategoria(nome) {
    const n = nome.toLowerCase();
    const keywordsOleo = ['oil','fluido','aditivo','unilit','petronas','ipiranga','lubrax','shell','castrol','ypf','texaco','havoline','bardahl','radiex','elaion','agro','selenia','5w30','15w40','20w50','lubri','extron','deiton','evora','lynix','top auto'];
    const keywordsFiltro = ['filtro', 'fitro', 'filtrante', 'elemento', 'psl', 'tecfil', 'vox', 'fram'];
    if (keywordsFiltro.some(key => n.includes(key))) return 'Filtro';
    if (keywordsOleo.some(key => n.includes(key))) return 'Óleo';
    return 'Vitrine';
}

function renderizar(lista) {
    const listaEl = document.getElementById('lista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    let listaParaExibir = [...lista]; 
    if (ordemAlfabetica) {
        listaParaExibir.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    listaParaExibir.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'produto-card';
        const idDiff = `diff-${index}`;
        const valorContado = p.contagem === null ? '' : p.contagem;
        const d = p.contagem === null ? 0 : (p.contagem - p.saldo);
        const cor = p.contagem === null ? '#666' : (d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666'));
        
        card.innerHTML = `
            <div class="produto-info">
                <span class="produto-nome"><b style="color: #fca311;">[${p.barra}]</b> ${p.nome}</span>
                <small>ID: ${p.codItem} | Sist: <strong>${p.saldo.toFixed(2)}</strong></small>
            </div>
            <div class="produto-acoes">
                <input type="number" step="0.01" inputmode="decimal"
                       placeholder="Qtd" class="input-contagem" value="${valorContado}"
                       oninput="atualizarValor('${p.nome.replace(/'/g, "\\'")}', this.value, '${idDiff}')">
                <span id="${idDiff}" class="diff-badge" style="color: ${cor}">
                    Dif: ${p.contagem === null ? '--' : d.toFixed(2)}
                </span>
            </div>`;
        listaEl.appendChild(card);
    });
}

function atualizarValor(nome, valor, idCampo) {
    const p = produtos.find(item => item.nome === nome);
    if (p) {
        p.contagem = valor === "" ? null : parseFloat(valor);
        localStorage.setItem('estoque_salvo', JSON.stringify(produtos));
        
        const diffEl = document.getElementById(idCampo);
        if (diffEl) {
            if (p.contagem === null) {
                diffEl.innerText = "Dif: --";
                diffEl.style.color = "#666";
            } else {
                const d = p.contagem - p.saldo;
                diffEl.innerText = "Dif: " + d.toFixed(2);
                diffEl.style.color = d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666');
            }
        }
    }
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Modo paisagem
    
    const dadosDivergentes = produtos
        .filter(p => p.contagem !== null)
        .map(p => {
            const dif = (p.contagem - p.saldo).toFixed(2);
            return { ...p, dif: parseFloat(dif) };
        })
        .filter(p => p.dif !== 0)
        .map(p => [
            p.codItem,
            `[${p.barra}] ${p.nome}`, 
            p.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            p.saldo.toFixed(2), 
            p.contagem.toFixed(2), 
            p.dif.toFixed(2),
            (p.dif * p.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]);

    if (dadosDivergentes.length === 0) {
        alert("Nenhuma divergência encontrada!");
        return;
    }

    doc.setFontSize(16);
    doc.text("Relatório de Divergências com Impacto Financeiro", 14, 15);
    doc.autoTable({
        head: [['ID', 'Produto', 'Custo Un.', 'Sist.', 'Real', 'Dif.', 'Impacto R$']],
        body: dadosDivergentes,
        startY: 25,
        headStyles: { fillColor: [214, 40, 40] },
        columnStyles: { 1: { cellWidth: 80 } }
    });

    doc.save(`divergencias-financeiro-${new Date().toLocaleDateString()}.pdf`);
}
