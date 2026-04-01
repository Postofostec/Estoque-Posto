if (sessionStorage.getItem('logado') !== 'true') {
    window.location.href = 'login.html';
}

let produtos = [];
let ordemAlfabetica = false;

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

    // Eventos de Busca e Filtros
    document.getElementById('txtBusca').addEventListener('input', function() {
        const termo = this.value.toLowerCase();
        renderizar(produtos.filter(p => p.nome.toLowerCase().includes(termo) || p.barra.includes(termo)));
    });

    document.getElementById('btnOrdenar').onclick = () => {
        ordemAlfabetica = !ordemAlfabetica;
        renderizar(produtos);
    };

    document.getElementById('btnReset').onclick = () => {
        if(confirm("Reiniciar conferência?")) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    };

    ['btnVitrine', 'btnOleo', 'btnFiltro'].forEach(id => {
        document.getElementById(id).onclick = () => {
            const cat = id.replace('btn', '');
            renderizar(produtos.filter(p => p.categoria === cat));
        };
    });

    document.getElementById('btnExportar').onclick = gerarPDF;
});

// Reutilize as funções parseCSV, identificarCategoria, renderizar, atualizarValor e gerarPDF do código anterior.
function parseCSV(texto) {
    const linhas = texto.split('\n').filter(l => l.trim() !== '');
    const lista = [];
    const separador = ';'; 
    const cabecalho = linhas[0].split(separador).map(c => c.trim().toLowerCase());
    
    const idxNome = cabecalho.indexOf('des_item');
    const idxSaldo = cabecalho.indexOf('qtd_saldo');
    const idxBarra = cabecalho.indexOf('cod_barra');
    const idxCodItem = cabecalho.indexOf('cod_item');
    const idxCusto = cabecalho.indexOf('val_custo_unitario');

    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(separador);
        if (colunas.length < 2) continue;

        const nome = colunas[idxNome] || "Sem Nome";
        const barraCompleta = colunas[idxBarra] || "";
        const barraFinal = barraCompleta.length >= 4 ? barraCompleta.slice(-4) : barraCompleta;
        let saldoLimpo = colunas[idxSaldo]?.replace(/\./g, '').replace(',', '.') || "0";
        let custoLimpo = colunas[idxCusto]?.replace(/\./g, '').replace(',', '.') || "0";

        lista.push({ 
            codItem: colunas[idxCodItem] || "N/A",
            nome: nome,
            barra: barraFinal,
            saldo: parseFloat(saldoLimpo) || 0,
            custo: parseFloat(custoLimpo) || 0,
            categoria: identificarCategoria(nome), 
            contagem: null 
        });
    }
    return lista;
}

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
