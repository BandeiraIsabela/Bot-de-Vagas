const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');

function carregarEstado() {
  if (!fs.existsSync(STATE_FILE)) {
    return { vagasProcessadas: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return { vagasProcessadas: raw.vagasProcessadas || raw.vagasEnviadas || {} };
  } catch {
    return { vagasProcessadas: {} };
  }
}

function salvarEstado(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function jaFoiProcessada(state, vagaId) {
  return Boolean(state.vagasProcessadas[vagaId]);
}

function marcarComoProcessada(state, vaga) {
  state.vagasProcessadas[vaga.id] = {
    titulo: vaga.titulo,
    empresa: vaga.empresa,
    link: vaga.link,
    processadoEm: new Date().toISOString()
  };
}

module.exports = { carregarEstado, salvarEstado, jaFoiProcessada, marcarComoProcessada };
