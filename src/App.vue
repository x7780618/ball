<template>
  <div id="app">
    <!-- 左栏：比赛列表 -->
    <div class="left-panel">
      <h2>⚽ 今日比赛</h2>
      <div class="tabs">
        <div
          v-for="(tab, idx) in tabs"
          :key="idx"
          class="tab-item"
          :class="{ active: activeTab === idx }"
          @click="switchTab(idx)"
        >
          {{ tab }}
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-for="(day, dayIdx) in matchData" :key="dayIdx" class="day-group">
        <div class="day-title">
          {{ day.weekday }} {{ day.businessDate }} 共 {{ day.matchCount }} 场
        </div>
        <div v-for="(match, matchIdx) in day.subMatchList" :key="match.matchId" class="match-card">
          <div class="match-header">
            <span class="league">{{ match.leagueAbbName }}</span>
            <span class="team">{{ match.homeTeamAbbName }}</span>
            <span class="vs">VS</span>
            <span class="team">{{ match.awayTeamAbbName }}</span>
            <span class="match-num">{{ match.matchNumStr }}</span>
            <span class="match-time">{{ match.matchTime }}</span>
          </div>
          <div class="odds-row">
            <div
              class="odd-item"
              v-for="(item, idx) in getOptionsForMatch(match, currentPlayType)"
              :key="idx"
              @click="onSelectBet(dayIdx, matchIdx, currentPlayType, idx)"
              :class="{ selected: isSelected(dayIdx, matchIdx, currentPlayType, idx) }"
              :title="item.pv ? '' : '无赔率'"
            >
              <div class="odd-name">{{ item.xuanxiangname }}</div>
              <div class="odd-value">{{ item.pv || '-' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右栏：固定悬浮计算器 -->
    <div class="right-panel">
      <div class="right-header">
        <h2>📊 投注计算器</h2>
        <button class="clear-btn" @click="clearAllSelections">清除已选</button>
      </div>

      <div class="selected-matches">
        <div v-if="userSelections.matches && userSelections.matches.length">
          <div v-for="(m, idx) in userSelections.matches" :key="idx" class="selected-match">
            <div class="match-info">
              <span class="match-num-sm">{{ m.matchNum }}</span>
              <span>{{ m.homeTeamAbbName }} vs {{ m.awayTeamAbbName }}</span>
            </div>
            <div class="selected-options">
              <span v-for="p in m.plays" :key="p.option" class="option-tag">
                {{ p.type }}：{{ p.option }} ({{ p.odds }})
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip">请点击左侧赔率选择比赛</div>
      </div>

      <div class="controls">
        <div class="control-row">
          <label>倍数：</label>
          <input type="number" v-model.number="userSelections.betAmount" min="1" step="1" />
          <span class="unit">倍</span>
        </div>

        <div class="control-row">
          <label>串关：</label>
          <select v-model="selectedCombination" @change="onCombinationChange">
            <option v-for="n in availableCombinations" :key="n" :value="n">
              {{ n === 1 ? '单关' : n + '串1' }}
            </option>
          </select>
        </div>

        <div class="result-box">
          <div class="result-item">
            <span class="label">投注金额</span>
            <span class="value">{{ totalStake }} 元</span>
          </div>
          <div class="result-item">
            <span class="label">最高奖金</span>
            <span class="value highlight">{{ maxPayout }} 元</span>
          </div>
          <div class="result-item">
            <span class="label">最低奖金</span>
            <span class="value">{{ minPayout }} 元</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { fetchMatches } from './api/match';
import { calculatePayout } from './utils/calculator';

// 数据状态
const matchData = ref([]);
const loading = ref(true);

// 用户选择
const userSelections = reactive({
  betAmount: 1,
  combinations: [1],
  matches: [],
  totalStake: 0,
  maxPayout: '0.00',
  minPayout: '0.00'
});

// 记录选中状态
const selectedMap = reactive({});
const selectedCombination = ref(1);
const tabs = ['混合投注', '进球数', '半全场', '比分'];
const activeTab = ref(0);

const currentPlayType = computed(() => {
  const map = ['sfp', 'zjq', 'bqc', 'bf'];
  return map[activeTab.value] || 'sfp';
});

function switchTab(idx) {
  activeTab.value = idx;
}

// ---------- 获取某场比赛对应玩法的选项 ----------
function getOptionsForMatch(match, playType) {
  const had = match.had || {};
  const hhad = match.hhad || {};
  const ttg = match.ttg || {};
  const hafu = match.hafu || {};
  const crs = match.crs || {};

  const configs = {
    sfp: [
      { name: '胜', pv: had.h },
      { name: '平', pv: had.d },
      { name: '负', pv: had.a },
      { name: '让胜', pv: hhad.h },
      { name: '让平', pv: hhad.d },
      { name: '让负', pv: hhad.a }
    ],
    zjq: [
      { name: '0球', pv: ttg.s0 },
      { name: '1球', pv: ttg.s1 },
      { name: '2球', pv: ttg.s2 },
      { name: '3球', pv: ttg.s3 },
      { name: '4球', pv: ttg.s4 },
      { name: '5球', pv: ttg.s5 },
      { name: '6球', pv: ttg.s6 },
      { name: '7+', pv: ttg.s7 }
    ],
    bqc: [
      { name: '胜胜', pv: hafu.hh },
      { name: '胜平', pv: hafu.hd },
      { name: '胜负', pv: hafu.ha },
      { name: '平胜', pv: hafu.dh },
      { name: '平平', pv: hafu.dd },
      { name: '平负', pv: hafu.da },
      { name: '负胜', pv: hafu.ah },
      { name: '负平', pv: hafu.ad },
      { name: '负负', pv: hafu.aa }
    ],
    bf: [
      { name: '1:0', pv: crs.s01s00 },
      { name: '2:0', pv: crs.s02s00 },
      { name: '2:1', pv: crs.s02s01 },
      { name: '3:0', pv: crs.s03s00 },
      { name: '3:1', pv: crs.s03s01 },
      { name: '3:2', pv: crs.s03s02 },
      { name: '4:0', pv: crs.s04s00 },
      { name: '4:1', pv: crs.s04s01 },
      { name: '4:2', pv: crs.s04s02 },
      { name: '5:0', pv: crs.s05s00 },
      { name: '5:1', pv: crs.s05s01 },
      { name: '5:2', pv: crs.s05s02 },
      { name: '胜其他', pv: crs.s1sh },
      { name: '0:0', pv: crs.s00s00 },
      { name: '1:1', pv: crs.s01s01 },
      { name: '2:2', pv: crs.s02s02 },
      { name: '3:3', pv: crs.s03s03 },
      { name: '平其他', pv: crs.s1sd },
      { name: '0:1', pv: crs.s00s01 },
      { name: '0:2', pv: crs.s00s02 },
      { name: '1:2', pv: crs.s01s02 },
      { name: '0:3', pv: crs.s00s03 },
      { name: '1:3', pv: crs.s01s03 },
      { name: '2:3', pv: crs.s02s03 },
      { name: '0:4', pv: crs.s00s04 },
      { name: '1:4', pv: crs.s01s04 },
      { name: '2:4', pv: crs.s02s04 },
      { name: '0:5', pv: crs.s00s05 },
      { name: '1:5', pv: crs.s01s05 },
      { name: '2:5', pv: crs.s02s05 },
      { name: '负其他', pv: crs.s1sa }
    ]
  };

  const items = configs[playType] || [];
  return items.map(item => ({
    xuanxiangname: item.name,
    pv: item.pv || ''
  }));
}

// ---------- 判断是否选中 ----------
function isSelected(dayIdx, matchIdx, playType, optionIdx) {
  const key = `${dayIdx}-${matchIdx}-${playType}-${optionIdx}`;
  return !!selectedMap[key];
}

// ---------- 点击选择/取消 ----------
function onSelectBet(dayIdx, matchIdx, playType, optionIdx) {
  const match = matchData.value[dayIdx]?.subMatchList?.[matchIdx];
  if (!match) return;
  const items = getOptionsForMatch(match, playType);
  const item = items[optionIdx];
  if (!item.pv) return;

  const key = `${dayIdx}-${matchIdx}-${playType}-${optionIdx}`;
  if (selectedMap[key]) {
    delete selectedMap[key];
    rebuildSelections();
    updateAvailableCombinations();
    recalc();
    return;
  }

  // 检查同一场比赛是否已有其他玩法（除sfp外）
  const matchKeyPrefix = `${dayIdx}-${matchIdx}`;
  let hasOtherPlayType = false;
  for (const k in selectedMap) {
    if (k.startsWith(matchKeyPrefix)) {
      const parts = k.split('-');
      const existingPlayType = parts[2];
      if (existingPlayType !== playType && !(existingPlayType === 'sfp' && playType === 'sfp')) {
        hasOtherPlayType = true;
        break;
      }
    }
  }
  if (hasOtherPlayType) {
    alert('一场比赛仅可选择一种玩法（胜平负/让球可同时选）');
    return;
  }

  selectedMap[key] = true;
  rebuildSelections();
  updateAvailableCombinations();
  recalc();
}

// ---------- 一键清除 ----------
function clearAllSelections() {
  for (const key in selectedMap) {
    delete selectedMap[key];
  }
  rebuildSelections();
  updateAvailableCombinations();
  recalc();
}

// ---------- 重建 userSelections.matches ----------
function rebuildSelections() {
  const newMatches = [];
  for (let dayIdx = 0; dayIdx < matchData.value.length; dayIdx++) {
    const day = matchData.value[dayIdx];
    for (let matchIdx = 0; matchIdx < day.subMatchList.length; matchIdx++) {
      const match = day.subMatchList[matchIdx];
      const plays = [];
      for (const key in selectedMap) {
        const parts = key.split('-');
        if (parseInt(parts[0]) === dayIdx && parseInt(parts[1]) === matchIdx) {
          const playType = parts[2];
          const optIdx = parseInt(parts[3]);
          const items = getOptionsForMatch(match, playType);
          const item = items[optIdx];
          if (item && item.pv) {
            const typeMap = { sfp: '胜平负', zjq: '总进球', bqc: '半全场', bf: '比分' };
            let typeDisplay = typeMap[playType] || '未知';
            if (playType === 'sfp') {
              typeDisplay = item.xuanxiangname.includes('让') ? '让球' : '胜平负';
            }
            plays.push({
              type: typeDisplay,
              option: item.xuanxiangname,
              odds: parseFloat(item.pv)
            });
          }
        }
      }
      if (plays.length > 0) {
        newMatches.push({
          matchId: match.matchId,
          homeTeamAbbName: match.homeTeamAbbName,
          awayTeamAbbName: match.awayTeamAbbName,
          matchNum: match.matchNum,
          matchTime: match.matchTime,
          plays
        });
      }
    }
  }
  userSelections.matches = newMatches;
}

// ---------- 可用串关 ----------
const availableCombinations = ref([1]);

function updateAvailableCombinations() {
  const len = userSelections.matches ? userSelections.matches.length : 0;
  const maxN = Math.min(len, 8);
  const arr = [];
  for (let i = 1; i <= maxN; i++) arr.push(i);
  availableCombinations.value = arr;
  if (!arr.includes(selectedCombination.value)) {
    selectedCombination.value = arr.length ? arr[arr.length - 1] : 1;
  }
  userSelections.combinations = [selectedCombination.value];
}

function onCombinationChange() {
  userSelections.combinations = [selectedCombination.value];
  recalc();
}

// ---------- 计算 ----------
function recalc() {
  if (!userSelections.matches || userSelections.matches.length === 0) {
    userSelections.totalStake = 0;
    userSelections.maxPayout = '0.00';
    userSelections.minPayout = '0.00';
    return;
  }
  const result = calculatePayout(userSelections);
  userSelections.totalStake = result.totalStake;
  userSelections.maxPayout = result.maxPayout.toFixed(2);
  userSelections.minPayout = result.minPayout.toFixed(2);
}

const totalStake = computed(() => userSelections.totalStake);
const maxPayout = computed(() => userSelections.maxPayout);
const minPayout = computed(() => userSelections.minPayout);

watch(() => userSelections.betAmount, recalc);

// ---------- 初始化 ----------
onMounted(async () => {
  try {
    const data = await fetchMatches();
    matchData.value = data;
    loading.value = false;
    updateAvailableCombinations();
    recalc();
  } catch (e) {
    alert('数据加载失败，请检查网络或代理配置');
    console.error(e);
    loading.value = false;
  }
});
</script>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

#app {
  display: flex;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #f0f2f5;
  color: #1f2a3a;
}

/* ---------- 左栏 ---------- */
.left-panel {
  flex: 1;
  padding: 24px 28px 40px 28px;
  padding-right: 420px;          /* 与面板宽度一致，消除空白间隙 */
  background: #f7f9fc;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.left-panel h2 {
  font-size: 24px;
  margin-bottom: 16px;
  color: #1f2a3a;
  border-left: 5px solid #07c160;
  padding-left: 14px;
  letter-spacing: 0.5px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: #ffffff;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #5a6a7a;
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.tab-item.active {
  background: #07c160;
  color: #fff;
  box-shadow: 0 2px 6px rgba(7, 193, 96, 0.3);
}

.tab-item:hover:not(.active) {
  background: #eef2f7;
}

.loading {
  text-align: center;
  padding: 60px 0;
  font-size: 16px;
  color: #a0aec0;
}

.day-group {
  background: #ffffff;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s;
}

.day-group:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.day-title {
  font-weight: 600;
  font-size: 17px;
  color: #2c3e50;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeff4;
  margin-bottom: 16px;
}

.match-card {
  padding: 14px 0;
  border-bottom: 1px solid #f2f4f8;
}

.match-card:last-child {
  border-bottom: none;
}

.match-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.league {
  background: #e8edf4;
  padding: 2px 14px;
  border-radius: 20px;
  font-size: 12px;
  color: #2c3e50;
  font-weight: 500;
}

.team {
  font-weight: 500;
  font-size: 16px;
}

.vs {
  color: #8e9aaf;
  font-weight: 400;
  font-size: 13px;
}

.match-num {
  color: #6b7a8d;
  font-size: 13px;
  background: #f0f2f5;
  padding: 0 10px;
  border-radius: 6px;
}

.match-time {
  color: #8e9aaf;
  font-size: 13px;
  margin-left: auto;
}

.odds-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.odd-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 62px;
  padding: 6px 10px;
  border: 1px solid #dde1e6;
  border-radius: 24px;
  cursor: pointer;
  background: #fff;
  transition: all 0.15s ease;
  user-select: none;
  font-size: 13px;
  line-height: 1.4;
}

.odd-item:hover {
  background: #f0f5ff;
  border-color: #b0c4de;
  transform: translateY(-1px);
}

.odd-item.selected {
  background: #07c160;
  color: white;
  border-color: #07c160;
  box-shadow: 0 2px 8px rgba(7, 193, 96, 0.25);
}

.odd-item .odd-name {
  font-weight: 500;
}

.odd-item .odd-value {
  font-size: 15px;
  font-weight: 600;
  margin-top: 1px;
}

.odd-item.selected .odd-value {
  color: white;
}

/* ---------- 右侧固定悬浮面板 ---------- */
.right-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 420px;
  height: 100vh;
  background: #ffffff;
  padding: 24px 22px 30px 22px;
  border-left: 1px solid #e4e8ed;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.04);
  z-index: 100;
}

.right-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.right-header h2 {
  font-size: 22px;
  color: #1f2a3a;
  margin: 0;
}

.clear-btn {
  background: #f0f2f5;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  color: #5a6a7a;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.clear-btn:hover {
  background: #ffebee;
  color: #e53935;
}

/* 已选列表 – 自适应高度，无最大高度，随内容撑开，右侧面板滚动 */
.selected-matches {
  flex: 0 0 auto;
  margin-bottom: 16px;
  border: 1px solid #edf0f4;
  border-radius: 12px;
  padding: 14px;
  background: #fafbfc;
  min-height: 80px;
}

.empty-tip {
  color: #a0aec0;
  text-align: center;
  padding: 20px 0;
  font-size: 14px;
}

.selected-match {
  background: #f1f8fe;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 10px;
  border-left: 3px solid #07c160;
}

.selected-match:last-child {
  margin-bottom: 0;
}

.match-info {
  display: flex;
  gap: 10px;
  font-weight: 500;
  font-size: 14px;
}

.match-num-sm {
  color: #6b7a8d;
  font-weight: 400;
}

.selected-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.option-tag {
  background: #e8f0fe;
  padding: 2px 12px;
  border-radius: 16px;
  font-size: 13px;
  color: #1f2a3a;
}

.controls {
  border-top: 1px solid #edf0f4;
  padding-top: 16px;
  flex-shrink: 0;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.control-row label {
  font-weight: 500;
  font-size: 14px;
  width: 56px;
  flex-shrink: 0;
}

.control-row input,
.control-row select {
  padding: 8px 12px;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  transition: border 0.2s, box-shadow 0.2s;
}

.control-row input:focus,
.control-row select:focus {
  border-color: #07c160;
  outline: none;
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.1);
}

.control-row input {
  width: 80px;
}

.unit {
  font-size: 14px;
  color: #5a6a7a;
}

.result-box {
  background: #f7f9fc;
  border-radius: 12px;
  padding: 16px 18px;
  margin-top: 6px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 15px;
}

.result-item .label {
  color: #5a6a7a;
}

.result-item .value {
  font-weight: 600;
}

.result-item .highlight {
  color: #07c160;
}

/* 滚动条优化 */
.left-panel::-webkit-scrollbar,
.right-panel::-webkit-scrollbar {
  width: 6px;
}
.left-panel::-webkit-scrollbar-track,
.right-panel::-webkit-scrollbar-track {
  background: #f0f2f5;
}
.left-panel::-webkit-scrollbar-thumb,
.right-panel::-webkit-scrollbar-thumb {
  background: #c4cdd8;
  border-radius: 3px;
}
.left-panel::-webkit-scrollbar-thumb:hover,
.right-panel::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .left-panel {
    padding-right: 16px;
    height: auto;
    overflow-y: visible;
  }
  .right-panel {
    position: static;
    width: 100%;
    height: auto;
    border-left: none;
    border-top: 1px solid #e4e8ed;
    box-shadow: none;
    padding: 16px;
    z-index: auto;
    overflow-y: visible;
  }
  .selected-matches {
    max-height: none;
  }
}
</style>