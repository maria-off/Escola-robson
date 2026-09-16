(function () {
  'use strict';

  /* ==========================================================
     CONSTANTES E CONFIGURAÇÕES
     ========================================================== */
  const STORAGE_KEY = 'preconselho_fichas_v1';

  const SENHAS = {
    professor: 'prof123',
    admin: 'admin123'
  };

  const TURMAS = [
    '6º Ano A', '6º Ano B',
    '7º Ano A', '7º Ano B',
    '8º Ano A', '8º Ano B',
    '9º Ano A', '9º Ano B'
  ];

  const COMPONENTES = [
    'Arte',
    'Ciências',
    'Educação Física',
    'Ensino Religioso',
    'Estudos Orientados',
    'Geografia',
    'História',
    'Língua Inglesa',
    'Língua Portuguesa',
    'Matemática',
    'Práticas Experimentais',
    'Projeto de Vida'
  ];

  /* ==========================================================
     ESTADO GLOBAL
     ========================================================== */
  let usuarioAtual = null;
  let fichaNoModal = null;
  let callbackConfirmacao = null;

  /* ==========================================================
     HELPERS
     ========================================================== */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  function uid() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hojeISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  }

  function dataBR(iso) {
    if (!iso) return '—';
    const partes = String(iso).split('-');
    if (partes.length !== 3) return iso;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function dataHoraBR(isoTs) {
    if (!isoTs) return '—';
    const d = new Date(isoTs);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function unicos(arr) {
    return Array.from(new Set(arr.filter(v => v && String(v).trim())))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function preencherSelect(sel, valores, placeholder) {
    sel.innerHTML = '<option value="">' + esc(placeholder) + '</option>' +
      valores.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  }

  /* ==========================================================
     FEEDBACK VISUAL (TOASTS)
     ========================================================== */
  function toast(mensagem, tipo) {
    tipo = tipo || 'sucesso';
    const icones = { sucesso: '✅', erro: '⚠️', info: 'ℹ️' };

    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.innerHTML = '<span>' + (icones[tipo] || '') + '</span><span>' + esc(mensagem) + '</span>';
    $('#toastContainer').appendChild(el);

    setTimeout(function () {
      el.style.transition = 'opacity .3s ease, transform .3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(26px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 3300);
  }

  /* ==========================================================
     PERSISTÊNCIA (localStorage)
     ========================================================== */
  function carregarFichas() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('Falha ao ler localStorage:', e);
      return [];
    }
  }

  function gravarFichas(lista) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      return true;
    } catch (e) {
      toast('Não foi possível salvar os dados neste navegador.', 'erro');
      return false;
    }
  }

  function ordenarPorAtualizacao(a, b) {
    return String(b.atualizadoEm || b.criadoEm || '')
      .localeCompare(String(a.atualizadoEm || a.criadoEm || ''));
  }

  /* ==========================================================
     LOGIN / LOGOUT
     ========================================================== */
  function tratarLogin(evento) {
    evento.preventDefault();

    const perfil = ($('input[name="perfil"]:checked') || {}).value || 'professor';
    const senha = $('#senha').value.trim();
    const erroEl = $('#loginErro');

    if (!senha) {
      erroEl.textContent = 'Digite a senha de acesso para continuar.';
      erroEl.classList.remove('hidden');
      animarErro();
      return;
    }

    if (senha !== SENHAS[perfil]) {
      erroEl.textContent = 'Senha incorreta para o perfil selecionado. Tente novamente.';
      erroEl.classList.remove('hidden');
      animarErro();
      return;
    }

    erroEl.classList.add('hidden');
    $('#senha').value = '';
    entrar(perfil);
  }

  function animarErro() {
    const card = $('#loginCard');
    card.classList.remove('tremer');
    void card.offsetWidth;
    card.classList.add('tremer');
  }

  function entrar(perfil) {
    usuarioAtual = perfil;

    $('#loginScreen').classList.add('hidden');
    $('#appScreen').classList.remove('hidden');

    $('#userChip').textContent = perfil === 'admin'
      ? '👨‍💼 Diretor(a) — Administrador'
      : '👩‍🏫 Professor(a)';

    if (perfil === 'admin') {
      $('#viewProfessor').classList.add('hidden');
      $('#viewAdmin').classList.remove('hidden');
      renderAdmin();
      toast('Bem-vindo(a), Diretor(a)!', 'sucesso');
    } else {
      $('#viewAdmin').classList.add('hidden');
      $('#viewProfessor').classList.remove('hidden');
      if (!$('#dataFicha').value) $('#dataFicha').value = hojeISO();
      renderMinhasFichas();
      toast('Bem-vindo(a), Professor(a)!', 'sucesso');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function sair() {
    usuarioAtual = null;
    fichaNoModal = null;

    fecharModal();
    fecharConfirmacao();

    $('#appScreen').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    $('#viewProfessor').classList.add('hidden');
    $('#viewAdmin').classList.add('hidden');
    $('#loginErro').classList.add('hidden');
    $('#senha').value = '';
    limparFormulario();

    toast('Sessão encerrada com segurança.', 'info');
  }

  /* ==========================================================
     FORMULÁRIO DO PROFESSOR
     ========================================================== */
  function coletarFormulario() {
    return {
      componente: $('#componente').value,
      professor: $('#professor').value.trim(),
      turma: $('#turma').value,
      data: $('#dataFicha').value,
      panoramaDesenvolvimento: $('#panoramaDesenvolvimento').value.trim(),
      panoramaParticipacao: $('#panoramaParticipacao').value.trim(),
      dificuldades: $('#dificuldades').value.trim(),
      frequencia: $('#frequencia').value.trim(),
      destaques: $('#destaques').value.trim(),
      observacoes: $('#observacoes').value.trim()
    };
  }

  function validarFormulario(dados) {
    if (!dados.componente) return 'Selecione o Componente Curricular.';
    if (!dados.professor) return 'Informe o nome do(a) Professor(a).';
    if (!dados.turma) return 'Selecione a Turma.';
    if (!dados.data) return 'Informe a Data da ficha.';
    return null;
  }

  function tratarEnvioFicha(evento) {
    evento.preventDefault();

    const dados = coletarFormulario();
    const erro = validarFormulario(dados);

    if (erro) {
      toast(erro, 'erro');
      return;
    }

    const fichas = carregarFichas();
    const idAtual = $('#fichaId').value;
    const agora = new Date().toISOString();
    const indice = idAtual ? fichas.findIndex(f => f.id === idAtual) : -1;

    let idFinal;
    let mensagem;

    if (indice > -1) {
      fichas[indice] = Object.assign({}, fichas[indice], dados, { atualizadoEm: agora });
      idFinal = fichas[indice].id;
      mensagem = 'Ficha atualizada com sucesso!';
    } else {
      const nova = Object.assign({
        id: uid(),
        criadoEm: agora,
        atualizadoEm: agora
      }, dados);
      fichas.push(nova);
      idFinal = nova.id;
      mensagem = 'Ficha salva com sucesso!';
    }

    if (!gravarFichas(fichas)) return;

    $('#fichaId').value = idFinal;
    $('#statusSalvo').textContent = '✔ Salvo às ' +
      new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    toast(mensagem, 'sucesso');
    renderMinhasFichas();
  }

  function limparFormulario() {
    $('#fichaForm').reset();
    $('#fichaId').value = '';
    $('#dataFicha').value = hojeISO();
    $('#statusSalvo').textContent = '';
  }

  function novaFicha() {
    limparFormulario();
    toast('Formulário limpo. Pronto para uma nova ficha.', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function carregarFichaNoFormulario(id) {
    const ficha = carregarFichas().find(f => f.id === id);
    if (!ficha) {
      toast('Registro não encontrado.', 'erro');
      return;
    }

    $('#fichaId').value = ficha.id;
    $('#componente').value = ficha.componente || '';
    $('#professor').value = ficha.professor || '';
    $('#turma').value = ficha.turma || '';
    $('#dataFicha').value = ficha.data || hojeISO();
    $('#panoramaDesenvolvimento').value = ficha.panoramaDesenvolvimento || '';
    $('#panoramaParticipacao').value = ficha.panoramaParticipacao || '';
    $('#dificuldades').value = ficha.dificuldades || '';
    $('#frequencia').value = ficha.frequencia || '';
    $('#destaques').value = ficha.destaques || '';
    $('#observacoes').value = ficha.observacoes || '';

    $('#statusSalvo').textContent = 'Editando ficha salva em ' +
      dataHoraBR(ficha.atualizadoEm || ficha.criadoEm);

    toast('Ficha carregada para edição.', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================
     RENDERIZAÇÃO — LISTA DO PROFESSOR
     ========================================================== */
  function renderMinhasFichas() {
    const fichas = carregarFichas().slice().sort(ordenarPorAtualizacao);
    const container = $('#listaMinhasFichas');

    $('#contadorFichas').textContent = fichas.length;

    if (!fichas.length) {
      container.innerHTML =
        '<p class="vazio">Nenhuma ficha salva ainda. Preencha o formulário acima e clique em “Salvar Ficha”.</p>';
      return;
    }

    container.innerHTML = fichas.map(function (f) {
      return '' +
        '<div class="ficha-item">' +
          '<div>' +
            '<strong>' + esc(f.turma || 'Turma não informada') + '</strong>' +
            '<span class="badge">' + esc(f.componente || '—') + '</span>' +
            '<p>' + esc(f.professor || '—') + ' · ' + dataBR(f.data) +
            ' · salva em ' + dataHoraBR(f.atualizadoEm || f.criadoEm) + '</p>' +
          '</div>' +
          '<div class="ficha-item-acoes">' +
            '<button class="btn btn-ghost btn-sm" data-acao="ver" data-id="' + f.id + '">👁 Ver</button>' +
            '<button class="btn btn-primary btn-sm" data-acao="editar" data-id="' + f.id + '">✏️ Abrir</button>' +
            '<button class="btn btn-danger btn-sm" data-acao="excluir" data-id="' + f.id + '">🗑 Excluir</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ==========================================================
     RENDERIZAÇÃO — PAINEL DO ADMINISTRADOR
     ========================================================== */
  function preencherFiltroSelect(sel, valores, placeholder) {
    const atual = sel.value;
    sel.innerHTML = '<option value="">' + esc(placeholder) + '</option>' +
      valores.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    sel.value = valores.indexOf(atual) > -1 ? atual : '';
  }

  function renderAdmin() {
    const todas = carregarFichas().slice().sort(ordenarPorAtualizacao);

    preencherFiltroSelect($('#filtroTurma'), unicos(todas.map(f => f.turma)), 'Todas as turmas');
    preencherFiltroSelect($('#filtroProfessor'), unicos(todas.map(f => f.professor)), 'Todos os professores');
    preencherFiltroSelect($('#filtroComponente'), unicos(todas.map(f => f.componente)), 'Todos os componentes');

    const fTurma = $('#filtroTurma').value;
    const fProf  = $('#filtroProfessor').value;
    const fComp  = $('#filtroComponente').value;

    const filtradas = todas.filter(function (f) {
      if (fTurma && f.turma !== fTurma) return false;
      if (fProf && f.professor !== fProf) return false;
      if (fComp && f.componente !== fComp) return false;
      return true;
    });

    renderTabela(filtradas);
    renderStats(todas, filtradas);
  }

  function renderStats(todas, filtradas) {
    $('#statsAdmin').innerHTML = '' +
      '<div class="stat"><span class="stat-num">' + todas.length + '</span><span class="stat-lbl">Fichas salvas</span></div>' +
      '<div class="stat"><span class="stat-num">' + filtradas.length + '</span><span class="stat-lbl">Exibidas no filtro</span></div>' +
      '<div class="stat"><span class="stat-num">' + unicos(todas.map(f => f.turma)).length + '</span><span class="stat-lbl">Turmas</span></div>' +
      '<div class="stat"><span class="stat-num">' + unicos(todas.map(f => f.professor)).length + '</span><span class="stat-lbl">Professores</span></div>';
  }

  function renderTabela(fichas) {
    const corpo = $('#corpoTabela');

    if (!fichas.length) {
      corpo.innerHTML = '<tr><td colspan="6" class="tabela-vazia">' +
        'Nenhuma ficha encontrada. Ajuste os filtros ou aguarde o envio dos professores.' +
        '</td></tr>';
      return;
    }

    corpo.innerHTML = fichas.map(function (f) {
      return '' +
        '<tr>' +
          '<td>' + dataBR(f.data) + '</td>' +
          '<td><strong>' + esc(f.turma || '—') + '</strong></td>' +
          '<td><span class="badge">' + esc(f.componente || '—') + '</span></td>' +
          '<td>' + esc(f.professor || '—') + '</td>' +
          '<td class="text-muted">' + dataHoraBR(f.atualizadoEm || f.criadoEm) + '</td>' +
          '<td>' +
            '<div class="acoes">' +
              '<button class="btn btn-primary btn-sm" data-acao="ver" data-id="' + f.id + '">👁 Visualizar</button>' +
              '<button class="btn btn-ghost btn-sm" data-acao="imprimir" data-id="' + f.id + '">🖨 PDF</button>' +
              '<button class="btn btn-danger btn-sm" data-acao="excluir" data-id="' + f.id + '">🗑 Excluir</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
    }).join('');
  }

  /* ==========================================================
     DOCUMENTO (VISUALIZAÇÃO E IMPRESSÃO)
     ========================================================== */
  function resposta(txt) {
    const t = (txt || '').trim();
    if (!t) return '<p class="resposta vazia">Não informado.</p>';
    return '<p class="resposta">' + esc(t) + '</p>';
  }

  function documentoHTML(f) {
    return '' +
    '<div class="doc">' +

      '<div class="doc-head">' +
        '<h3>ECLA ESTADUAL DO CAMPO FREI GRACIANO DROESSLER</h3>' +
        '<p>Ensino Fundamental em Tempo Integral</p>' +
        '<h4>FICHA INDIVIDUAL — PRÉ-CONSELHO DE CLASSE</h4>' +
      '</div>' +

      '<div class="doc-ident">' +
        '<div><span>Componente Curricular</span><strong>' + esc(f.componente || '—') + '</strong></div>' +
        '<div><span>Professor(a)</span><strong>' + esc(f.professor || '—') + '</strong></div>' +
        '<div><span>Turma</span><strong>' + esc(f.turma || '—') + '</strong></div>' +
        '<div><span>Data</span><strong>' + dataBR(f.data) + '</strong></div>' +
      '</div>' +

      '<section class="doc-secao">' +
        '<h5>1. Panorama da Turma</h5>' +
        '<div class="doc-questao">' +
          '<p class="rotulo">Como você avalia o desenvolvimento geral da turma em relação à aprendizagem?</p>' +
          resposta(f.panoramaDesenvolvimento) +
        '</div>' +
        '<div class="doc-questao">' +
          '<p class="rotulo">Como está a participação, o envolvimento e a postura dos estudantes nas aulas?</p>' +
          resposta(f.panoramaParticipacao) +
        '</div>' +
      '</section>' +

      '<section class="doc-secao">' +
        '<h5>2. Aprendizagem e Frequência</h5>' +
        '<div class="doc-questao">' +
          '<p class="rotulo">Quais habilidades/conteúdos apresentam maior dificuldade para a turma?</p>' +
          resposta(f.dificuldades) +
        '</div>' +
        '<div class="doc-questao">' +
          '<p class="rotulo">Há estudantes com baixa frequência ou que necessitam de acompanhamento mais próximo? Quais e por quê?</p>' +
          resposta(f.frequencia) +
        '</div>' +
      '</section>' +

      '<section class="doc-secao">' +
        '<h5>3. Destaques e Situações que Merecem Atenção</h5>' +
        '<div class="doc-questao">' +
          '<p class="rotulo">Estudantes que se destacaram positivamente (aprendizagem, participação, responsabilidade ou protagonismo):</p>' +
          resposta(f.destaques) +
        '</div>' +
        '<div class="doc-questao">' +
          '<p class="rotulo">Observações gerais e notas:</p>' +
          resposta(f.observacoes) +
        '</div>' +
      '</section>' +

      '<div class="doc-rodape">' +
        '<div><span>Registrado em</span><strong>' + dataHoraBR(f.criadoEm) + '</strong></div>' +
        '<div><span>Última atualização</span><strong>' + dataHoraBR(f.atualizadoEm || f.criadoEm) + '</strong></div>' +
        '<div class="assinatura">Assinatura do(a) Professor(a)</div>' +
      '</div>' +

    '</div>';
  }

  /* ==========================================================
     MODAL — FICHA COMPLETA
     ========================================================== */
  function abrirModal(id) {
    const ficha = carregarFichas().find(f => f.id === id);
    if (!ficha) {
      toast('Registro não encontrado.', 'erro');
      return;
    }

    fichaNoModal = ficha;
    $('#modalBody').innerHTML = documentoHTML(ficha);
    $('#modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function fecharModal() {
    $('#modal').classList.add('hidden');
    $('#modalBody').innerHTML = '';
    fichaNoModal = null;
    document.body.style.overflow = '';
  }

  function imprimirFicha(id) {
    const ficha = carregarFichas().find(f => f.id === id);
    if (!ficha) {
      toast('Registro não encontrado para impressão.', 'erro');
      return;
    }

    $('#printArea').innerHTML = documentoHTML(ficha);
    toast('Preparando impressão...', 'info');

    setTimeout(function () {
      window.print();
    }, 120);
  }

  /* ==========================================================
     CONFIRMAÇÃO E EXCLUSÃO
     ========================================================== */
  function pedirConfirmacao(mensagem, callback) {
    $('#confirmTexto').textContent = mensagem;
    callbackConfirmacao = callback;
    $('#confirmModal').classList.remove('hidden');
  }

  function fecharConfirmacao() {
    $('#confirmModal').classList.add('hidden');
    $('#confirmTexto').textContent = '';
    callbackConfirmacao = null;
  }

  function excluirFicha(id) {
    const ficha = carregarFichas().find(f => f.id === id);
    if (!ficha) {
      toast('Registro não encontrado.', 'erro');
      return;
    }

    pedirConfirmacao(
      'Excluir definitivamente a ficha de ' + (ficha.turma || '—') + ' — ' +
      (ficha.componente || '—') + ' (' + dataBR(ficha.data) + ')? Esta ação não pode ser desfeita.',
      function () {
        const restantes = carregarFichas().filter(f => f.id !== id);

        if (!gravarFichas(restantes)) return;

        if (fichaNoModal && fichaNoModal.id === id) fecharModal();
        if ($('#fichaId').value === id) limparFormulario();

        toast('Registro excluído com sucesso.', 'info');

        if (usuarioAtual === 'admin') renderAdmin();
        if (usuarioAtual === 'professor') renderMinhasFichas();
      }
    );
  }

  /* ==========================================================
     DELEGAÇÃO DE EVENTOS — LISTA DO PROFESSOR
     ========================================================== */
  function tratarCliqueLista(evento) {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.getAttribute('data-id');
    const acao = botao.getAttribute('data-acao');

    if (acao === 'ver') abrirModal(id);
    if (acao === 'editar') carregarFichaNoFormulario(id);
    if (acao === 'excluir') excluirFicha(id);
  }

  /* ==========================================================
     DELEGAÇÃO DE EVENTOS — TABELA DO ADMIN
     ========================================================== */
  function tratarCliqueTabela(evento) {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const id = botao.getAttribute('data-id');
    const acao = botao.getAttribute('data-acao');

    if (acao === 'ver') abrirModal(id);
    if (acao === 'imprimir') imprimirFicha(id);
    if (acao === 'excluir') excluirFicha(id);
  }

  /* ==========================================================
     INICIALIZAÇÃO E BINDINGS
     ========================================================== */
  function bindEventos() {
    // Login / Logout
    $('#loginForm').addEventListener('submit', tratarLogin);
    $('#btnSair').addEventListener('click', sair);

    // Formulário do professor
    $('#fichaForm').addEventListener('submit', tratarEnvioFicha);
    $('#btnNovaFicha').addEventListener('click', novaFicha);
    $('#listaMinhasFichas').addEventListener('click', tratarCliqueLista);

    // Painel do administrador
    $('#corpoTabela').addEventListener('click', tratarCliqueTabela);
    $('#filtroTurma').addEventListener('change', renderAdmin);
    $('#filtroProfessor').addEventListener('change', renderAdmin);
    $('#filtroComponente').addEventListener('change', renderAdmin);

    $('#btnLimparFiltros').addEventListener('click', function () {
      $('#filtroTurma').value = '';
      $('#filtroProfessor').value = '';
      $('#filtroComponente').value = '';
      renderAdmin();
      toast('Filtros limpos.', 'info');
    });

    // Modal da ficha
    $('#btnFecharModal').addEventListener('click', fecharModal);
    $('#btnFecharModalX').addEventListener('click', fecharModal);
    $('#btnImprimirModal').addEventListener('click', function () {
      if (fichaNoModal) imprimirFicha(fichaNoModal.id);
    });
    $('#btnExcluirModal').addEventListener('click', function () {
      if (fichaNoModal) excluirFicha(fichaNoModal.id);
    });
    $('#modal').addEventListener('click', function (e) {
      if (e.target === $('#modal')) fecharModal();
    });

    // Modal de confirmação
    $('#btnCancelarExclusao').addEventListener('click', fecharConfirmacao);
    $('#btnFecharConfirmX').addEventListener('click', fecharConfirmacao);
    $('#btnConfirmarExclusao').addEventListener('click', function () {
      const cb = callbackConfirmacao;
      fecharConfirmacao();
      if (typeof cb === 'function') cb();
    });
    $('#confirmModal').addEventListener('click', function (e) {
      if (e.target === $('#confirmModal')) fecharConfirmacao();
    });

    // Tecla ESC fecha modais
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#confirmModal').classList.contains('hidden')) {
        fecharConfirmacao();
      } else if (!$('#modal').classList.contains('hidden')) {
        fecharModal();
      }
    });
  }

  function init() {
    preencherSelect($('#componente'), COMPONENTES, 'Selecione o componente...');
    preencherSelect($('#turma'), TURMAS, 'Selecione a turma...');
    $('#dataFicha').value = hojeISO();

    bindEventos();
  }

  document.addEventListener('DOMContentLoaded', init);

})();