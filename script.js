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

    // Busca
    document.getElementById('txtBusca').addEventListener('input', function() {
        const termo = this.value.toLowerCase();
        renderizar(produtos.filter(p => p.nome.toLowerCase().includes(termo) || p.barra.includes(termo)));
    });

    // Ordenação (Aqui sim re-renderiza pois muda a posição)
    document.getElementById('btnOrdenar').onclick = () => {
        ordemAlfabetica = !ordemAlfabetica;
        document.getElementById('btnOrdenar').innerText = ordemAlfabetica ? "Ordem: CSV" : "Ordem: A-Z";
        renderizar(produtos);
    };

    // Filtros
    ['btnVitrine', 'btnOleo', 'btnFiltro'].forEach(id => {
        document.getElementById(id).onclick = () => {
            const cat = id.replace('btn', '');
            renderizar(produtos.filter(p => p.categoria === cat));
        };
    });

    // Reset
    document.getElementById('btnReset').onclick = () => {
        if(confirm("Limpar tudo e recarregar da nuvem?")) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    };

    document.getElementById('btnExportar').onclick = gerarPDF;
});

function parseCSV(texto) {
    const linhas = texto.split('\n').filter(l => l.trim() !== '');
    const lista = [];
    const separador = texto.includes(';') ? ';' : ','; 
    const cabecalho = linhas[0].split(separador).map(c => c.trim().toLowerCase());
    
    const idxNome = cabecalho.indexOf('des_item');
    const idxSaldo = cabecalho.indexOf('qtd_saldo');
    const idxBarra = cabecalho.indexOf('cod_barra');
    const idxCusto = cabecalho.indexOf('val_custo_unitario');

    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(separador);
        if (colunas.length < 2) continue;

        const nome = colunas[idxNome] || "Sem Nome";
        let saldo = colunas[idxSaldo]?.replace(/\./g, '').replace(',', '.') || "0";
        let custo = colunas[idxCusto]?.replace(/\./g, '').replace(',', '.') || "0";

        lista.push({ 
            nome: nome,
            barra: (colunas[idxBarra] || "").slice(-4),
            saldo: parseFloat(saldo) || 0,
            custo: parseFloat(custo) || 0,
            categoria: identificarCategoria(nome),
            contagem: null 
        });
    }
    return lista;
}

function identificarCategoria(nome) {
    const n = nome.toLowerCase();
    if (n.includes('filtro')) return 'Filtro';
    const oleos = ['oil','5w30','15w40','20w50','lubrax','shell','ipiranga','petronas','lubri','extron'];
    if (oleos.some(key => n.includes(key))) return 'Oleo';
    return 'Vitrine';
}

function renderizar(lista) {
    const listaEl = document.getElementById('lista');
    listaEl.innerHTML = '';
    let exibicao = [...lista];
    if (ordemAlfabetica) exibicao.sort((a, b) => a.nome.localeCompare(b.nome));

    exibicao.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'produto-card';
        const d = p.contagem === null ? 0 : (p.contagem - p.saldo);
        const cor = p.contagem === null ? '#666' : (d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666'));
        
        // Atribuí um ID único para o badge de diferença para atualizar via JS direto
        const diffId = `diff-${p.nome.replace(/\s+/g, '-')}`;

        card.innerHTML = `
            <div class="produto-info">
                <span class="produto-nome"><b>[${p.barra}]</b> ${p.nome}</span>
                <small>Sist: ${p.saldo.toFixed(2)}</small>
            </div>
            <div class="produto-acoes">
                <input type="number" 
                       inputmode="decimal" 
                       step="0.01" 
                       class="input-contagem" 
                       placeholder="0.00"
                       value="${p.contagem !== null ? p.contagem : ''}" 
                       oninput="atualizarValor('${p.nome.replace(/'/g, "\\'")}', this.value, '${diffId}')">
                <span id="${diffId}" class="diff-badge" style="color: ${cor}">
                    Dif: ${p.contagem === null ? '--' : d.toFixed(2)}
                </span>
            </div>`;
        listaEl.appendChild(card);
    });
}

function atualizarValor(nome, valor, diffId) {
    const p = produtos.find(item => item.nome === nome);
    if (p) {
        p.contagem = valor === "" ? null : parseFloat(valor);
        localStorage.setItem('estoque_salvo', JSON.stringify(produtos));
        
        // ATUALIZAÇÃO MANUAL (SEM RE-RENDERIZAR A LISTA)
        const diffEl = document.getElementById(diffId);
        if (diffEl) {
            const d = (p.contagem || 0) - p.saldo;
            diffEl.innerText = p.contagem === null ? "Dif: --" : "Dif: " + d.toFixed(2);
            diffEl.style.color = d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666');
        }
    }
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const dados = produtos.filter(p => p.contagem !== null && (p.contagem - p.saldo) !== 0)
        .map(p => [p.nome, p.saldo.toFixed(2), p.contagem.toFixed(2), (p.contagem - p.saldo).toFixed(2)]);
    
    if (dados.length === 0) return alert("Sem divergências!");
    doc.text("Relatório Fostec", 14, 15);
    doc.autoTable({ head: [['Produto', 'Sist.', 'Real', 'Dif.']], body: dados, startY: 20 });
    doc.save('estoque.pdf');
}
