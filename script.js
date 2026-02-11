// 1. DECLARAÇÃO ÚNICA E VARIÁVEL DE ORDEM
let produtos = []; 
let ordemAlfabetica = false; 

document.addEventListener('DOMContentLoaded', function () {
    const csvInput = document.getElementById('csvInput');
    const txtBusca = document.getElementById('txtBusca');
    const btnExportar = document.getElementById('btnExportar');
    const btnReset = document.getElementById('btnReset');
    const btnOrdenar = document.getElementById('btnOrdenar'); // Captura o novo botão

    // --- LÓGICA DE RECUPERAÇÃO AUTOMÁTICA ---
    const salvo = localStorage.getItem('estoque_salvo');
    if (salvo) {
        produtos = JSON.parse(salvo);
        renderizar(produtos);
    }

    // Listener para o arquivo
    if(csvInput) {
        csvInput.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                produtos = parseCSV(e.target.result);
                // Salva a importação inicial
                localStorage.setItem('estoque_salvo', JSON.stringify(produtos));
                renderizar(produtos);
            };
            reader.readAsText(file);
        });
    }

    // Busca em tempo real
    if(txtBusca) {
        txtBusca.addEventListener('input', function() {
            const termo = this.value.toLowerCase();
            const filtrados = produtos.filter(p => 
                p.nome.toLowerCase().includes(termo) || 
                p.barra.includes(termo)
            );
            renderizar(filtrados);
        });
    }

    // Botão de Ordenação A-Z
    if (btnOrdenar) {
        btnOrdenar.onclick = () => {
            ordemAlfabetica = !ordemAlfabetica; // Alterna entre verdadeiro/falso
            btnOrdenar.innerText = ordemAlfabetica ? "Ordem: CSV" : "Ordem: A-Z";
            btnOrdenar.style.backgroundColor = ordemAlfabetica ? "#2a9d8f" : "#4a4e69";
            renderizar(produtos); // Re-renderiza a lista com a nova ordem
        };
    }

    // Botão de Reset
    if (btnReset) {
        btnReset.onclick = function() {
            if (confirm("Deseja apagar toda a contagem e começar do zero?")) {
                localStorage.removeItem('estoque_salvo');
                produtos = [];
                document.getElementById('lista').innerHTML = '';
                if (csvInput) csvInput.value = '';
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
    
    // Mapeamento das novas colunas
    const idxNome = cabecalho.indexOf('des_item');
    const idxSaldo = cabecalho.indexOf('qtd_saldo');
    const idxBarra = cabecalho.indexOf('cod_barra');
    const idxCodItem = cabecalho.indexOf('cod_item'); // Novo
    const idxCusto = cabecalho.indexOf('val_custo_unitario'); // Novo

    for (let i = 1; i < linhas.length; i++) {
        const colunas = linhas[i].split(separador);
        if (colunas.length < 2) continue;

        const nome = colunas[idxNome] || "Sem Nome";
        const barraCompleta = colunas[idxBarra] || "";
        const barraFinal = barraCompleta.length >= 4 ? barraCompleta.slice(-4) : barraCompleta;
        let saldoLimpo = colunas[idxSaldo]?.replace(/\./g, '').replace(',', '.') || "0";
        let custoLimpo = colunas[idxCusto]?.replace(/\./g, '').replace(',', '.') || "0";

        lista.push({ 
            nome: nome,
            barra: barraFinal,
            codItem: colunas[idxCodItem] || "N/A", // Novo
            custo: parseFloat(custoLimpo) || 0, // Novo
            saldo: parseFloat(saldoLimpo) || 0,
            categoria: identificarCategoria(nome), 
            contagem: null,
            expressao: "" // Para guardar o texto da soma (ex: 2+8+3)
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

function avaliarExpressao(valor) {
    try {
        // Remove caracteres perigosos, permitindo apenas números e operadores básicos
        const expressaoLimpa = valor.replace(/[^-+*/.0-9]/g, '');
        if (!expressaoLimpa) return null;
        // eval() resolve a conta matemática (ex: "2+8*3" vira 26)
        return Function(`'use strict'; return (${expressaoLimpa})`)();
    } catch (e) {
        return null;
    }
}

function renderizar(lista) {
    const listaEl = document.getElementById('lista');
    if (!listaEl) return;
    listaEl.innerHTML = '';

    // --- LÓGICA DE ORDENAÇÃO APLICADA AQUI ---
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
                <span class="produto-nome">
                    <b style="color: #fca311;">[${p.barra}]</b> ${p.nome}
                </span>
                <small>Sistema: <strong>${p.saldo.toFixed(2)}</strong></small>
            </div>
            <div class="produto-acoes">
                <input type="text" step="0.01" 
                       placeholder="Qtd" 
                       class="input-contagem" 
                       value="${valorContado}"
                       oninput="atualizarValor('${p.nome.replace(/'/g, "\\'")}', this.value, '${idDiff}')">
                <span id="${idDiff}" class="diff-badge" style="color: ${cor}">
                    Dif: ${p.contagem === null ? '--' : d.toFixed(2)}
                </span>
            </div>
        `;
        listaEl.appendChild(card);
    });
}

function atualizarValor(nome, valorOriginal, idCampo) {
    const p = produtos.find(item => item.nome === nome);
    if (p) {
        // Tenta calcular o que foi digitado
        const resultado = avaliarExpressao(valorOriginal);
        
        p.contagem = resultado;
        p.expressao = valorOriginal; // Salva o texto digitado

        localStorage.setItem('estoque_salvo', JSON.stringify(produtos));
        
        const diffEl = document.getElementById(idCampo);
        if (diffEl) {
            if (p.contagem === null) {
                diffEl.innerText = "Dif: --";
                diffEl.style.color = "#666";
            } else {
                const d = p.contagem - p.saldo;
                diffEl.innerText = `Total: ${p.contagem.toFixed(2)} | Dif: ${d.toFixed(2)}`;
                diffEl.style.color = d < 0 ? '#e63946' : (d > 0 ? '#2a9d8f' : '#666');
            }
        }
    }
}
function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // 'l' para modo paisagem (cabe mais colunas)
    
    const divergentes = produtos
        .filter(p => p.contagem !== null)
        .map(p => {
            const dif = (p.contagem - p.saldo).toFixed(2);
            return { ...p, dif: parseFloat(dif) };
        })
        .filter(p => p.dif !== 0)
        .map(p => [
            p.codItem,
            `[${p.barra}] ${p.nome}`, 
            p.custo.toFixed(2),
            p.saldo.toFixed(2), 
            p.contagem.toFixed(2), 
            p.dif.toFixed(2),
            (p.dif * p.custo).toFixed(2) // Valor total do prejuízo/sobra
        ]);

    if (divergentes.length === 0) {
        alert("Nenhuma divergência encontrada!");
        return;
    }

    doc.setFontSize(14);
    doc.text("Relatório de Divergências de Estoque com Custo", 14, 15);
    
    doc.autoTable({
        head: [['ID', 'Produto', 'Custo Un.', 'Sist.', 'Real', 'Dif.', 'Total R$']],
        body: divergentes,
        startY: 25,
        headStyles: { fillColor: [214, 40, 40] },
        columnStyles: { 
            1: { cellWidth: 80 }, // Largura do nome do produto
        }
    });

    doc.save(`divergencias-com-custo.pdf`);
}
