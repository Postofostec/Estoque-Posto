var produtos = []; 

document.addEventListener('DOMContentLoaded', function () {
    const csvInput = document.getElementById('csvInput');
    const txtBusca = document.getElementById('txtBusca');
    const btnExportar = document.getElementById('btnExportar');
    const btnReset = document.getElementById('btnReset');

    // --- LOGICA DE RECUPERAÇÃO (O que faz salvar ao atualizar) ---
    const salvo = localStorage.getItem('estoque_salvo');
    if (salvo) {
        produtos = JSON.parse(salvo);
        renderizar(produtos);
        console.log("Dados recuperados do LocalStorage");
    }

    if (csvInput) {
        csvInput.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                produtos = parseCSV(e.target.result);
                localStorage.setItem('estoque_salvo', JSON.stringify(produtos)); // Salva a importação
                renderizar(produtos);
            };
            reader.readAsText(file);
        });
    }

    if (txtBusca) {
        txtBusca.addEventListener('input', function() {
            const termo = this.value.toLowerCase();
            const filtrados = produtos.filter(p => 
                p.nome.toLowerCase().includes(termo) || 
                p.barra.includes(termo)
            );
            renderizar(filtrados);
        });
    }

    if (btnReset) {
        btnReset.onclick = function() {
            if (confirm("Apagar toda a contagem e começar do zero?")) {
                localStorage.removeItem('estoque_salvo');
                produtos = [];
                document.getElementById('lista').innerHTML = '';
                if(csvInput) csvInput.value = '';
                alert("Sistema limpo.");
            }
        };
    }

    // Configuração de filtros por categoria
    ['btnOleo', 'btnFiltro', 'btnVitrine'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                const cat = id === 'btnOleo' ? 'Óleo' : (id === 'btnFiltro' ? 'Filtro' : 'Vitrine');
                renderizar(produtos.filter(p => p.categoria === cat));
            };
        }
    });

    if (btnExportar) btnExportar.onclick = gerarPDF;
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
        
        lista.push({ 
            nome: nome, 
            barra: barraFinal,
            saldo: parseFloat(saldoLimpo) || 0, 
            categoria: identificarCategoria(nome),
            contagem: null 
        });
    }
    return lista;
}

function identificarCategoria(nome) {
    const n = nome.toLowerCase();
    const keywordsOleo = ['oil','fluido','aditivo','unilit','petronas','ipiranga','lubrax','shell','castrol','ypf','texaco','havoline','bardahl','radiex','elaion','agro','selenia','5w30','15w40','20w50','lubri','extron','deiton','evora','lynix','top auto'];
    const keywordsFiltro = ['filtro', 'fitro', 'filtrante', 'elemento', 'psl', 'tecfil', 'fram'];
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
        const idDiff = `diff-${index}`;
        const valorContado = p.contagem === null ? '' : p.contagem;
        const d = p.contagem === null ? 0 : (p.contagem - p.saldo);
        const cor = p.contagem === null ? '#666' : (d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666'));

        card.innerHTML = `
            <div class="produto-info">
                <span class="produto-nome"><b style="color: #fca311;">[${p.barra}]</b> ${p.nome}</span>
                <small>Sistema: ${p.saldo.toFixed(2)}</small>
            </div>
            <div class="produto-acoes">
                <input type="number" step="0.01" class="input-contagem" value="${valorContado}"
                       oninput="atualizarValor('${p.nome.replace(/'/g, "\\'")}', this.value, '${idDiff}')">
                <span id="${idDiff}" class="diff-badge" style="color: ${cor}">Dif: ${p.contagem === null ? '--' : d.toFixed(2)}</span>
            </div>`;
        listaEl.appendChild(card);
    });
}

function atualizarValor(nome, valor, idCampo) {
    const p = produtos.find(item => item.nome === nome);
    if (p) {
        p.contagem = valor === "" ? null : parseFloat(valor);
        localStorage.setItem('estoque_salvo', JSON.stringify(produtos)); // SALVA A CADA DIGITAÇÃO
        const diffEl = document.getElementById(idCampo);
        if (diffEl) {
            const d = p.contagem === null ? 0 : (p.contagem - p.saldo);
            diffEl.innerText = "Dif: " + (p.contagem === null ? "--" : d.toFixed(2));
            diffEl.style.color = p.contagem === null ? '#666' : (d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666'));
        }
    }
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const divergentes = produtos.filter(p => p.contagem !== null && (parseFloat(p.contagem - p.saldo).toFixed(2) != 0));
    if (divergentes.length === 0) return alert("Nenhuma divergência para exportar!");
    const rows = divergentes.map(p => [`[${p.barra}] ${p.nome}`, p.saldo.toFixed(2), p.contagem.toFixed(2), (p.contagem - p.saldo).toFixed(2)]);
    doc.text("Relatorio de Divergencias", 14, 15);
    doc.autoTable({ head: [['Item', 'Sist.', 'Real', 'Dif.']], body: rows, startY: 20 });
    doc.save("divergencias.pdf");
}

