import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput, Pressable,
  StyleSheet, Alert, useColorScheme, StatusBar, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
 
const STORE_KEY = 'livrocaixa_tx_v1';
 
const CATS = {
  expense: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Outros'],
  income: ['Salário', 'Outros'],
  save: ['Poupança', 'Reserva de emergência', 'Dinheiro guardado', 'Outros'],
  invest: ['Renda fixa', 'Ações', 'Fundos imobiliários', 'Criptomoedas', 'Outros'],
};
 
const TYPES = [
  { key: 'expense', label: 'Saída', sign: '-' },
  { key: 'income', label: 'Entrada', sign: '+' },
  { key: 'save', label: 'Guardar', sign: '↓' },
  { key: 'invest', label: 'Investir', sign: '↑' },
];
 
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
 
const LIGHT = {
  paper: '#ECE7D8', line: '#D8D0BA', ink: '#1F2B22', soft: '#5B6459', card: '#F5F2E7',
  income: '#2F5233', expense: '#8C3B2E', save: '#A9812F', invest: '#3C6E71',
};
const DARK = {
  paper: '#171C17', line: '#2B342B', ink: '#EAE7DA', soft: '#A7AE9E', card: '#1F251E',
  income: '#7FA37F', expense: '#D98D7C', save: '#D3AE5C', invest: '#7FBFC2',
};
 
const fmt = (n) => {
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
};
 
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthLabel = (y, m) => `${MONTHS[m]} de ${y}`;
const sum = (items, type) => items.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
 
export default function App() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? DARK : LIGHT;
  const s = makeStyles(c);
 
  const now = new Date();
  const [txs, setTxs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [type, setType] = useState('expense');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState(CATS.expense[0]);
 
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((v) => { if (v) setTxs(JSON.parse(v)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
 
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORE_KEY, JSON.stringify(txs)).catch(() => {});
  }, [txs, loaded]);
 
  const changeType = (k) => { setType(k); setCategory(CATS[k][0]); };
 
  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  };
 
  const addTx = () => {
    const value = parseFloat(String(amount).replace(',', '.'));
    if (!desc.trim() || !value || value <= 0) {
      Alert.alert('Atenção', 'Preencha a descrição e um valor válido.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Atenção', 'Use a data no formato AAAA-MM-DD.');
      return;
    }
    setTxs([...txs, { id: Date.now().toString(36), desc: desc.trim(), amount: value, date, category, type }]);
    setDesc(''); setAmount('');
  };
 
  const removeTx = (id) => {
    Alert.alert('Remover lançamento', 'Deseja remover este lançamento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => setTxs(txs.filter((t) => t.id !== id)) },
    ]);
  };
 
  const key = `${year}-${pad(month + 1)}`;
  const items = txs.filter((t) => t.date.slice(0, 7) === key)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
 
  const income = sum(items, 'income');
  const expense = sum(items, 'expense');
  const saved = sum(items, 'save');
  const invested = sum(items, 'invest');
  const balance = income - expense - saved - invested;
 
  const totSave = sum(txs, 'save');
  const totInv = sum(txs, 'invest');
  const hist = {};
  txs.filter((t) => t.type === 'save' || t.type === 'invest').forEach((t) => {
    const k = t.date.slice(0, 7);
    hist[k] = hist[k] || { save: 0, invest: 0 };
    hist[k][t.type] += t.amount;
  });
  const histKeys = Object.keys(hist).sort().reverse();
 
  const Stat = ({ label, value, color }) => (
    <View style={s.stat}>
      <Text style={s.k}>{label}</Text>
      <Text style={[s.statV, { color }]}>{fmt(value)}</Text>
    </View>
  );
 
  const Breakdown = ({ title, kind }) => {
    const map = {};
    items.filter((t) => t.type === kind).forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const max = entries[0][1];
    return (
      <View style={{ marginBottom: 8 }}>
        <Text style={s.section}>{title}</Text>
        {entries.map(([cat, val]) => (
          <View key={cat} style={{ marginBottom: 8 }}>
            <View style={s.rowBetween}>
              <Text style={s.small}>{cat}</Text>
              <Text style={s.small}>{fmt(val)}</Text>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${(val / max) * 100}%`, backgroundColor: c[kind] }]} />
            </View>
          </View>
        ))}
      </View>
    );
  };
 
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Livro-caixa</Text>
        <Text style={s.sub}>Seu controle de entradas e saídas, guardado neste dispositivo.</Text>
 
        <View style={s.card}>
          <Text style={s.k}>Saldo do mês</Text>
          <Text style={[s.big, { color: balance < 0 ? c.expense : c.ink }]}>{fmt(balance)}</Text>
          <View style={s.stats}>
            <Stat label="Entradas" value={income} color={c.income} />
            <Stat label="Saídas" value={expense} color={c.expense} />
            <Stat label="Guardado" value={saved} color={c.save} />
            <Stat label="Investido" value={invested} color={c.invest} />
          </View>
        </View>
 
        <View style={s.card}>
          <Text style={s.k}>Acumulado de todos os meses</Text>
          <View style={s.stats}>
            <Stat label="Guardado" value={totSave} color={c.save} />
            <Stat label="Investido" value={totInv} color={c.invest} />
          </View>
          {histKeys.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={s.histRow}>
                <Text style={[s.k, s.hCol1]}>Mês</Text>
                <Text style={[s.k, s.hCol]}>Guardado</Text>
                <Text style={[s.k, s.hCol]}>Investido</Text>
              </View>
              {histKeys.map((k) => {
                const [y, m] = k.split('-');
                return (
                  <View key={k} style={s.histRow}>
                    <Text style={[s.small, s.hCol1]}>{MONTHS[+m - 1].slice(0, 3)}/{y}</Text>
                    <Text style={[s.small, s.hCol, { color: c.save }]}>{fmt(hist[k].save)}</Text>
                    <Text style={[s.small, s.hCol, { color: c.invest }]}>{fmt(hist[k].invest)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
 
        <View style={s.monthNav}>
          <Pressable style={s.navBtn} onPress={() => changeMonth(-1)}><Text style={s.navTxt}>‹</Text></Pressable>
          <Text style={s.monthTxt}>{monthLabel(year, month)}</Text>
          <Pressable style={s.navBtn} onPress={() => changeMonth(1)}><Text style={s.navTxt}>›</Text></Pressable>
        </View>
 
        <View style={s.card}>
          <Text style={s.section}>Novo lançamento</Text>
          <View style={s.toggle}>
            {TYPES.map((t) => {
              const active = type === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => changeType(t.key)}
                  style={[s.toggleBtn, active && { backgroundColor: c[t.key], borderColor: c[t.key] }]}
                >
                  <Text style={[s.toggleTxt, active && { color: '#fff' }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
 
          <Text style={s.label}>Descrição</Text>
          <TextInput style={s.input} value={desc} onChangeText={setDesc}
            placeholder="Ex: Supermercado" placeholderTextColor={c.soft} />
 
          <View style={s.grid2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Valor (R$)</Text>
              <TextInput style={s.input} value={amount} onChangeText={setAmount}
                keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={c.soft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Data (AAAA-MM-DD)</Text>
              <TextInput style={s.input} value={date} onChangeText={setDate}
                placeholder="2026-01-31" placeholderTextColor={c.soft} />
            </View>
          </View>
 
          <Text style={s.label}>Categoria</Text>
          <View style={s.chips}>
            {CATS[type].map((cat) => (
              <Pressable key={cat} onPress={() => setCategory(cat)}
                style={[s.chip, category === cat && { backgroundColor: c.ink, borderColor: c.ink }]}>
                <Text style={[s.chipTxt, category === cat && { color: c.paper }]}>{cat}</Text>
              </Pressable>
            ))}
          </View>
 
          <Pressable style={s.submit} onPress={addTx}>
            <Text style={s.submitTxt}>Adicionar lançamento</Text>
          </Pressable>
        </View>
 
        <Breakdown title="Gastos por categoria" kind="expense" />
        <Breakdown title="Guardado por categoria" kind="save" />
        <Breakdown title="Investido por categoria" kind="invest" />
 
        <Text style={s.section}>Lançamentos do mês</Text>
        {items.length === 0 && <Text style={s.empty}>Nenhum lançamento neste mês ainda.</Text>}
        {items.map((t) => {
          const sign = TYPES.find((x) => x.key === t.type).sign;
          const [y, m, d] = t.date.split('-');
          return (
            <View key={t.id} style={s.tx}>
              <View style={{ flex: 1 }}>
                <Text style={s.txDesc} numberOfLines={1}>{t.desc}</Text>
                <Text style={s.txCat}>{d}/{m}/{y} · {t.category}</Text>
              </View>
              <Text style={[s.txAmt, { color: c[t.type] }]}>{sign} {fmt(t.amount)}</Text>
              <Pressable onPress={() => removeTx(t.id)} hitSlop={10}>
                <Text style={s.del}>✕</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
 
const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
 
const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  wrap: { padding: 18, paddingBottom: 60 },
  h1: { fontFamily: serif, fontWeight: '700', fontSize: 27, color: c.ink },
  sub: { color: c.soft, fontSize: 13, marginBottom: 18, marginTop: 2 },
  card: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 6, padding: 18, marginBottom: 16 },
  k: { color: c.soft, fontSize: 12 },
  big: { fontFamily: serif, fontSize: 32, fontWeight: '600', color: c.ink, marginTop: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line },
  stat: { width: '50%', marginBottom: 10 },
  statV: { fontFamily: serif, fontSize: 17 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 5, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  navTxt: { color: c.ink, fontSize: 18 },
  monthTxt: { color: c.ink, fontWeight: '600', fontSize: 15, textTransform: 'capitalize' },
  section: { color: c.soft, fontWeight: '600', fontSize: 13, marginBottom: 10 },
  toggle: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 5, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, alignItems: 'center' },
  toggleTxt: { color: c.soft, fontWeight: '600', fontSize: 12.5 },
  label: { color: c.soft, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 5, backgroundColor: c.paper, color: c.ink, paddingHorizontal: 10, paddingVertical: 9, fontSize: 15 },
  grid2: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper },
  chipTxt: { color: c.ink, fontSize: 12.5 },
  submit: { backgroundColor: c.ink, borderRadius: 5, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  submitTxt: { color: c.paper, fontWeight: '600', fontSize: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  small: { color: c.ink, fontSize: 13 },
  track: { height: 6, backgroundColor: c.line, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
  histRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line },
  hCol1: { flex: 1.1 },
  hCol: { flex: 1, textAlign: 'right' },
  tx: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line, gap: 10 },
  txDesc: { color: c.ink, fontSize: 15, fontWeight: '500' },
  txCat: { color: c.soft, fontSize: 12 },
  txAmt: { fontFamily: serif, fontSize: 15 },
  del: { color: c.soft, fontSize: 16, paddingHorizontal: 4 },
  empty: { color: c.soft, textAlign: 'center', paddingVertical: 24 },
});
 