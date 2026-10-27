<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import api from './api';

const token = ref(localStorage.getItem('token') || '');
const usuario = ref(JSON.parse(localStorage.getItem('usuario') || 'null'));
const tela = ref('inicio');
const mensagem = ref('');
const erro = ref('');
const carregando = ref(false);
const pacientes = ref([]);
const medicos = ref([]);
const convenios = ref([]);
const consultas = ref([]);
const historico = ref([]);
const filtro = ref('');
const login = reactive({ email: '', senha: '' });
const paciente = reactive({ nome:'', cpf:'', data_nascimento:'', telefone:'', endereco:'', email:'' });
const medico = reactive({ nome:'', cpf:'', registro_profissional:'', especialidade:'', telefone:'', email:'' });
const convenio = reactive({ nome:'', codigo:'', telefone:'', email:'' });
const consulta = reactive({ paciente_id:'', medico_id:'', convenio_id:'', especialidade:'', data_consulta:'', horario:'', tipo_atendimento:'Particular', observacoes:'' });
const atendimento = reactive({ consulta_id:'', motivo:'', observacoes:'', procedimentos:'', orientacoes:'' });
const slots = ref([]);
const podeGerenciar = computed(() => ['Administrador','Atendente'].includes(usuario.value?.perfil));
const podeAdmin = computed(() => usuario.value?.perfil === 'Administrador');

function limparAvisos(){ mensagem.value=''; erro.value=''; }
function avisar(e){ erro.value=e.response?.data?.erro || e.message || 'Ocorreu um erro.'; mensagem.value=''; }
async function executar(fn){ limparAvisos(); carregando.value=true; try { await fn(); } catch(e){ avisar(e); } finally { carregando.value=false; } }
async function entrar(){ await executar(async()=>{ const {data}=await api.post('/auth/login',login); token.value=data.token; usuario.value=data.usuario; localStorage.setItem('token',token.value); localStorage.setItem('usuario',JSON.stringify(usuario.value)); tela.value='inicio'; await carregarTudo(); }); }
async function sair(){ try { if(token.value) await api.post('/auth/logout'); } catch {} token.value=''; usuario.value=null; localStorage.removeItem('token'); localStorage.removeItem('usuario'); tela.value='inicio'; }
async function carregarTudo(){ if(!token.value)return; await Promise.all([listarPacientes(),listarMedicos(),listarConvenios(),listarConsultas()]); }
async function listarPacientes(){ const {data}=await api.get('/pacientes',{params:{q:filtro.value}}); pacientes.value=data; }
async function listarMedicos(){ const {data}=await api.get('/medicos'); medicos.value=data; }
async function listarConvenios(){ const {data}=await api.get('/convenios'); convenios.value=data; }
async function listarConsultas(){ const {data}=await api.get('/consultas'); consultas.value=data; }
async function salvarPaciente(){ await executar(async()=>{ await api.post('/pacientes',paciente); Object.keys(paciente).forEach(k=>paciente[k]=''); mensagem.value='Paciente cadastrado.'; await listarPacientes(); }); }
async function salvarMedico() {
  await executar(async () => {
    await api.post('/medicos', medico);
    Object.keys(medico).forEach((chave) => {
      medico[chave] = '';
    });
    mensagem.value = 'Médico cadastrado.';
    await listarMedicos();
  });
}
async function excluirMedico(m) {
  if (!podeAdmin.value) {
    erro.value = 'Somente o administrador pode excluir médicos.';
    return;
  }

  if (!confirm(`Deseja realmente excluir o médico ${m.nome}?`)) {
    return;
  }

  await executar(async () => {
    await api.delete(`/medicos/${m.id}`);
    mensagem.value = 'Médico excluído com sucesso.';
    await listarMedicos();
    await listarConsultas();
  });
}
async function salvarConvenio(){ await executar(async()=>{ await api.post('/convenios',convenio); Object.keys(convenio).forEach(k=>convenio[k]=''); mensagem.value='Convênio cadastrado.'; await listarConvenios(); }); }

async function verificarHorarios() {
  await executar(async () => {
    if (!consulta.medico_id || !consulta.data_consulta) {
      throw new Error('Selecione o médico e a data.');
    }

    const { data } = await api.get('/consultas/disponibilidade', {
      params: {
        medico_id: consulta.medico_id,
        data: consulta.data_consulta
      }
    });

    console.log('Resposta recebida:', data);
    console.log('É uma lista?', Array.isArray(data));

    slots.value = data;

    mensagem.value = `Foram encontrados ${slots.value.length} horários disponíveis.`;
  });
}

async function salvarConsulta(){ await executar(async()=>{ await api.post('/consultas',consulta); mensagem.value='Consulta agendada.'; Object.assign(consulta,{paciente_id:'',medico_id:'',convenio_id:'',especialidade:'',data_consulta:'',horario:'',tipo_atendimento:'Particular',observacoes:''}); slots.value=[]; await listarConsultas(); }); }
async function acaoConsulta(c,acao){ await executar(async()=>{ if(acao==='cancelar'){ if(!confirm('Deseja realmente cancelar esta consulta?')) return; await api.patch(`/consultas/${c.id}/cancelar`); } else if(acao==='confirmar'){ await api.patch(`/consultas/${c.id}/confirmar`); } else if(acao==='reagendar'){ const data_consulta=prompt('Nova data (AAAA-MM-DD):',String(c.data_consulta).slice(0,10)); if(!data_consulta)return; const horario=prompt('Novo horário (HH:MM):',String(c.horario).slice(0,5)); if(!horario)return; await api.patch(`/consultas/${c.id}/reagendar`,{data_consulta,horario}); } mensagem.value='Consulta atualizada.'; await listarConsultas(); }); }
async function salvarAtendimento(){ await executar(async()=>{ await api.post('/atendimentos',atendimento); Object.keys(atendimento).forEach(k=>atendimento[k]=''); mensagem.value='Atendimento registrado.'; await listarConsultas(); }); }
async function verHistorico(p){ await executar(async()=>{ const {data}=await api.get(`/pacientes/${p.id}/historico`); historico.value=data; tela.value='historico'; mensagem.value=`Histórico de ${p.nome}`; }); }
onMounted(()=>{ if(token.value) carregarTudo().catch(e=>avisar(e)); });
</script>

<template>
  <div class="layout">
    <header class="topo">
      <div><div class="marca">Clínica<span>+</span></div><small>Sistema de Controle de Consultas</small></div>
      <div v-if="token" class="usuario"><span>{{ usuario?.nome }} · {{ usuario?.perfil }}</span><button class="secundario" @click="sair">Sair</button></div>
    </header>
    <main>
      <section v-if="!token" class="login painel">
        <h1>Acesso ao sistema</h1><p>Entre com seu e-mail e senha cadastrados.</p>
        <form @submit.prevent="entrar">
          <label>E-mail<input v-model="login.email" type="email" required autocomplete="username"></label>
          <label>Senha<input v-model="login.senha" type="password" required autocomplete="current-password"></label>
          <button :disabled="carregando">{{ carregando?'Entrando...':'Entrar' }}</button>
        </form>
      </section>
      <template v-else>
        <section class="boas-vindas"><div><h1>Olá, {{ usuario?.nome }}!</h1><p>Gerencie pacientes, profissionais e consultas em um só lugar.</p></div></section>
        <nav class="menu">
          <button v-for="item in [{id:'inicio',nome:'Painel'},{id:'pacientes',nome:'Pacientes'},{id:'medicos',nome:'Médicos'},{id:'convenios',nome:'Convênios'},{id:'consultas',nome:'Consultas'},{id:'atendimento',nome:'Atendimento'}]" :key="item.id" :class="{ativo:tela===item.id}" @click="tela=item.id; limparAvisos()">{{ item.nome }}</button>
        </nav>
        <div v-if="mensagem" class="alerta sucesso">{{ mensagem }}</div><div v-if="erro" class="alerta falha">{{ erro }}</div>
        <section v-if="tela==='inicio'" class="cards">
          <article class="card"><small>Pacientes ativos carregados</small><strong>{{ pacientes.length }}</strong><button @click="tela='pacientes'">Ver pacientes</button></article>
          <article class="card"><small>Médicos ativos</small><strong>{{ medicos.length }}</strong><button @click="tela='medicos'">Ver médicos</button></article>
          <article class="card"><small>Consultas registradas</small><strong>{{ consultas.length }}</strong><button @click="tela='consultas'">Ver consultas</button></article>
          <article class="card"><small>Convênios cadastrados</small><strong>{{ convenios.length }}</strong><button @click="tela='convenios'">Ver convênios</button></article>
        </section>
        <section v-if="tela==='pacientes'" class="painel">
          <h2>Cadastro de pacientes</h2>
          <form class="form-grid" @submit.prevent="salvarPaciente">
            <label>Nome completo<input v-model="paciente.nome" required></label><label>CPF<input v-model="paciente.cpf" required></label>
            <label>Data de nascimento<input v-model="paciente.data_nascimento" type="date"></label><label>Telefone<input v-model="paciente.telefone"></label>
            <label>E-mail<input v-model="paciente.email" type="email"></label><label>Endereço<input v-model="paciente.endereco"></label>
            <button :disabled="carregando">Cadastrar paciente</button>
          </form>
          <div class="linha"><h3>Pacientes cadastrados</h3><input v-model="filtro" placeholder="Buscar por nome ou CPF" @input="listarPacientes"></div>
          <div class="tabela"><table><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Histórico</th></tr></thead><tbody><tr v-for="p in pacientes" :key="p.id"><td>{{p.nome}}</td><td>{{p.cpf}}</td><td>{{p.telefone||'—'}}</td><td><button class="pequeno" @click="verHistorico(p)">Ver histórico</button></td></tr></tbody></table></div>
        </section>
        <section v-if="tela==='medicos'" class="painel">
          <h2>Cadastro de médicos</h2>
          <form class="form-grid" @submit.prevent="salvarMedico">
            <label>Nome completo<input v-model="medico.nome" required></label><label>CPF<input v-model="medico.cpf" required></label>
            <label>Registro profissional<input v-model="medico.registro_profissional" required></label><label>Especialidade<input v-model="medico.especialidade" required></label>
            <label>Telefone<input v-model="medico.telefone"></label><label>E-mail<input v-model="medico.email" type="email"></label>
            <button :disabled="!podeAdmin||carregando">{{ podeAdmin?'Cadastrar médico':'Somente administrador cadastra médicos' }}</button>
          </form>
          <h3>Médicos ativos</h3>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Especialidade</th>
                  <th>Registro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in medicos" :key="m.id">
                  <td>{{ m.nome }}</td>
                  <td>{{ m.especialidade }}</td>
                  <td>{{ m.registro_profissional }}</td>
                  <td>
                    <button
                      v-if="podeAdmin"
                      type="button"
                      class="pequeno perigo"
                      :disabled="carregando"
                      @click="excluirMedico(m)"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-if="tela==='convenios'" class="painel">
          <h2>Convênios</h2><form class="form-grid" @submit.prevent="salvarConvenio">
            <label>Nome do convênio<input v-model="convenio.nome" required></label><label>Código<input v-model="convenio.codigo" required></label>
            <label>Telefone<input v-model="convenio.telefone"></label><label>E-mail<input v-model="convenio.email" type="email"></label><button :disabled="carregando">Cadastrar convênio</button>
          </form>
          <h3>Convênios cadastrados</h3><div class="tabela"><table><thead><tr><th>Nome</th><th>Código</th><th>Situação</th></tr></thead><tbody><tr v-for="c in convenios" :key="c.id"><td>{{c.nome}}</td><td>{{c.codigo}}</td><td>{{c.ativo?'Ativo':'Inativo'}}</td></tr></tbody></table></div>
        </section>
        <section v-if="tela==='consultas'" class="painel">
          <h2>Agendar consulta</h2><form class="form-grid" @submit.prevent="salvarConsulta">
            <label>Paciente<select v-model="consulta.paciente_id" required><option value="">Selecione</option><option v-for="p in pacientes" :key="p.id" :value="p.id">{{p.nome}} — {{p.cpf}}</option></select></label>
            <label>Médico<select v-model="consulta.medico_id" required @change="consulta.especialidade=medicos.find(m=>m.id===Number(consulta.medico_id))?.especialidade||''"><option value="">Selecione</option><option v-for="m in medicos" :key="m.id" :value="m.id">{{m.nome}} — {{m.especialidade}}</option></select></label>
            <label>Especialidade<input v-model="consulta.especialidade" required></label><label>Data<input v-model="consulta.data_consulta" type="date" required></label>
            <label>Tipo de atendimento<select v-model="consulta.tipo_atendimento"><option>Particular</option><option :disabled="!convenios.some(c=>c.ativo)" value="Convênio">Convênio</option></select></label>
            <label>Convênio<select v-model="consulta.convenio_id" :required="consulta.tipo_atendimento==='Convênio'"><option value="">Sem convênio</option><option v-for="c in convenios.filter(c=>c.ativo)" :key="c.id" :value="c.id">{{c.nome}}</option></select></label>
            <label class="full">Observações<input v-model="consulta.observacoes"></label>
            <button type="button" class="secundario" @click="verificarHorarios">Verificar disponibilidade</button>
            <label>Horário disponível<select v-model="consulta.horario" required><option value="">Selecione</option><option v-for="h in slots" :key="h" :value="h">{{h}}</option></select></label>
            <button :disabled="carregando">Confirmar agendamento</button>
          </form>
          <h3>Agenda de consultas</h3><div class="tabela"><table><thead><tr><th>Data</th><th>Horário</th><th>Paciente</th><th>Médico</th><th>Convênio</th><th>Situação</th><th>Ações</th></tr></thead><tbody><tr v-for="c in consultas" :key="c.id"><td>{{String(c.data_consulta).slice(0,10)}}</td><td>{{String(c.horario).slice(0,5)}}</td><td>{{c.paciente_nome}}</td><td>{{c.medico_nome}}</td><td>{{c.convenio_nome||'Particular'}}</td><td><span class="status">{{c.situacao}}</span></td><td class="acoes"><button class="pequeno" v-if="c.situacao==='Agendada'" @click="acaoConsulta(c,'confirmar')">Confirmar</button><button class="pequeno secundario" v-if="['Agendada','Confirmada'].includes(c.situacao)" @click="acaoConsulta(c,'reagendar')">Reagendar</button><button class="pequeno perigo" v-if="['Agendada','Confirmada'].includes(c.situacao)" @click="acaoConsulta(c,'cancelar')">Cancelar</button></td></tr></tbody></table></div>
        </section>
        <section v-if="tela==='atendimento'" class="painel">
          <h2>Registrar atendimento</h2><p>O registro ficará vinculado à consulta e ao histórico do paciente.</p>
          <form class="form-grid" @submit.prevent="salvarAtendimento">
            <label class="full">Consulta<select v-model="atendimento.consulta_id" required><option value="">Selecione uma consulta</option><option v-for="c in consultas.filter(c=>['Agendada','Confirmada'].includes(c.situacao))" :key="c.id" :value="c.id">#{{c.id}} · {{c.paciente_nome}} · {{String(c.data_consulta).slice(0,10)}} {{String(c.horario).slice(0,5)}}</option></select></label>
            <label class="full">Motivo da consulta<input v-model="atendimento.motivo" required></label><label class="full">Observações<textarea v-model="atendimento.observacoes"></textarea></label>
            <label class="full">Procedimentos realizados<textarea v-model="atendimento.procedimentos"></textarea></label><label class="full">Orientações<textarea v-model="atendimento.orientacoes"></textarea></label>
            <button :disabled="!['Administrador','Profissional'].includes(usuario?.perfil)||carregando">Salvar atendimento</button>
          </form>
        </section>
        <section v-if="tela==='historico'" class="painel"><div class="linha"><h2>Histórico de consultas</h2><button class="secundario" @click="tela='pacientes'">Voltar</button></div>
          <div class="tabela"><table><thead><tr><th>Data</th><th>Horário</th><th>Médico</th><th>Especialidade</th><th>Situação</th><th>Motivo/Atendimento</th></tr></thead><tbody><tr v-for="h in historico" :key="h.id"><td>{{String(h.data_consulta).slice(0,10)}}</td><td>{{String(h.horario).slice(0,5)}}</td><td>{{h.medico_nome}}</td><td>{{h.especialidade}}</td><td>{{h.situacao}}</td><td>{{h.motivo||'—'}} {{h.procedimentos||''}}</td></tr></tbody></table></div>
        </section>
      </template>
    </main>
    <footer>Sistema de Controle de Consultas para Clínicas · Projeto acadêmico</footer>
  </div>
</template>
