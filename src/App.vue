<template>
  <div id="app">
    <main class="left-panel">
      <h2>今日比赛</h2>

      <div class="tabs">
        <button
          v-for="(tab, idx) in tabs"
          :key="tab"
          class="tab-item"
          :class="{ active: activeTab === idx }"
          type="button"
          @click="switchTab(idx)"
        >
          {{ tab }}
        </button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="!matchData.length" class="loading">暂无比赛数据</div>

      <section v-for="(day, dayIdx) in matchData" :key="day.businessDate || dayIdx" class="day-group">
        <div class="day-title">
          {{ day.weekday }} {{ day.businessDate }} 共 {{ day.matchCount }} 场
        </div>

        <article v-for="(match, matchIdx) in day.subMatchList" :key="match.matchId" class="match-card">
          <div class="match-header">
            <span class="league">{{ match.leagueAbbName }}</span>
            <span class="team">{{ match.homeTeamAbbName }}</span>
            <span v-if="currentPlayType === 'sfp' && getHandicap(match)" class="handicap-badge">{{ getHandicap(match) }}</span>
            <span class="vs">VS</span>
            <span class="team">{{ match.awayTeamAbbName }}</span>
            <span class="match-num">{{ match.matchNumStr }}</span>
            <span class="match-time">{{ match.matchTime }}</span>
          </div>

          <div class="odds-row">
            <div
              v-for="(item, idx) in getOptionsForMatch(match, currentPlayType)"
              :key="`${currentPlayType}-${idx}`"
              class="odd-wrapper"
            >
              <span v-if="currentPlayType === 'sfp' && idx === 0" class="group-label">胜平负</span>
              <span
                v-if="
                  currentPlayType === 'sfp' &&
                  item.isHandicap &&
                  (idx === 0 || !getOptionsForMatch(match, currentPlayType)[idx - 1].isHandicap)
                "
                class="group-label"
              >
                让球
              </span>

              <button
                class="odd-item"
                :class="{ handicap: item.isHandicap, selected: isSelected(dayIdx, matchIdx, currentPlayType, idx) }"
                :title="item.pv ? '' : '无赔率'"
                type="button"
                @click="onSelectBet(dayIdx, matchIdx, currentPlayType, idx)"
              >
                <span class="odd-name">
                  <span v-if="item.isHandicap" class="odd-badge">让</span>
                  {{ item.xuanxiangname.replace(/^让/, '') }}
                </span>
                <span class="odd-value">{{ item.pv || '-' }}</span>
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>

    <aside class="right-panel">
      <div class="right-header">
        <h2>投注计算器</h2>
        <button class="clear-btn" type="button" @click="clearAllSelections">清除已选</button>
      </div>

      <div class="selected-matches">
        <div v-if="userSelections.matches.length">
          <div v-for="(m, idx) in userSelections.matches" :key="`${m.matchId}-${idx}`" class="selected-match">
            <div class="match-info">
              <span class="match-num-sm">{{ m.matchNum }}</span>
              <span>{{ m.homeTeamAbbName }} vs {{ m.awayTeamAbbName }}</span>
            </div>
            <div class="selected-options">
              <span v-for="p in m.plays" :key="`${p.type}-${p.option}`" class="option-tag">
                {{ p.type }}: {{ p.option }} ({{ p.odds }})
              </span>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip">请点击左侧赔率选择比赛</div>
      </div>

      <div class="controls">
        <div class="control-row">
          <label for="bet-amount">倍数</label>
          <input id="bet-amount" v-model.number="userSelections.betAmount" min="1" step="1" type="number" />
          <span class="unit">倍</span>
        </div>

        <div class="control-row">
          <label for="combination">串关</label>
          <select id="combination" v-model.number="selectedCombination" @change="onCombinationChange">
            <option v-for="n in availableCombinations" :key="n" :value="n">
              {{ n === 1 ? '单关' : `${n}串1` }}
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
    </aside>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { fetchMatches } from './api/match';
import { calculatePayout } from './utils/calculator';

const matchData = ref([]);
const loading = ref(true);
const selectedMap = reactive({});
const selectedCombination = ref(1);
const availableCombinations = ref([1]);

const tabs = ['混合投注', '进球数', '半全场', '比分'];
const activeTab = ref(0);
const currentPlayType = computed(() => ['sfp', 'zjq', 'bqc', 'bf'][activeTab.value] || 'sfp');

const userSelections = reactive({
  betAmount: 1,
  combinations: [1],
  matches: [],
  totalStake: 0,
  maxPayout: '0.00',
  minPayout: '0.00',
});

const totalStake = computed(() => userSelections.totalStake);
const maxPayout = computed(() => userSelections.maxPayout);
const minPayout = computed(() => userSelections.minPayout);

function switchTab(idx) {
  activeTab.value = idx;
}

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
      { name: '让胜', pv: hhad.h, isHandicap: true },
      { name: '让平', pv: hhad.d, isHandicap: true },
      { name: '让负', pv: hhad.a, isHandicap: true },
    ],
    zjq: [
      { name: '0球', pv: ttg.s0 },
      { name: '1球', pv: ttg.s1 },
      { name: '2球', pv: ttg.s2 },
      { name: '3球', pv: ttg.s3 },
      { name: '4球', pv: ttg.s4 },
      { name: '5球', pv: ttg.s5 },
      { name: '6球', pv: ttg.s6 },
      { name: '7+', pv: ttg.s7 },
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
      { name: '负负', pv: hafu.aa },
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
      { name: '负其他', pv: crs.s1sa },
    ],
  };

  return (configs[playType] || []).map((item) => ({
    xuanxiangname: item.name,
    pv: item.pv || '',
    isHandicap: !!item.isHandicap,
  }));
}

function getHandicap(match) {
  if (!match) return '';

  if (match.hhad?.goalLine || match.hhad?.goalLine === 0) {
    return formatHandicap(match.hhad.goalLine);
  }

  if (Array.isArray(match.oddsList)) {
    const odds = match.oddsList.find((item) => item?.goalLine || item?.goalLine === 0);
    if (odds) return formatHandicap(odds.goalLine);
  }

  return '';
}

function formatHandicap(value) {
  const raw = String(value).trim();
  const num = Number.parseFloat(raw.replace(/[^0-9.+-]/g, ''));
  if (Number.isNaN(num)) return raw;
  return `让${num > 0 || raw.startsWith('+') ? '+' : ''}${num}`;
}

function isSelected(dayIdx, matchIdx, playType, optionIdx) {
  return !!selectedMap[`${dayIdx}-${matchIdx}-${playType}-${optionIdx}`];
}

function onSelectBet(dayIdx, matchIdx, playType, optionIdx) {
  const match = matchData.value[dayIdx]?.subMatchList?.[matchIdx];
  if (!match) return;

  const item = getOptionsForMatch(match, playType)[optionIdx];
  if (!item?.pv) return;

  const key = `${dayIdx}-${matchIdx}-${playType}-${optionIdx}`;
  if (selectedMap[key]) {
    delete selectedMap[key];
    refreshSelections();
    return;
  }

  const matchKeyPrefix = `${dayIdx}-${matchIdx}`;
  const hasOtherPlayType = Object.keys(selectedMap).some((selectedKey) => {
    if (!selectedKey.startsWith(matchKeyPrefix)) return false;
    const existingPlayType = selectedKey.split('-')[2];
    return existingPlayType !== playType && !(existingPlayType === 'sfp' && playType === 'sfp');
  });

  if (hasOtherPlayType) {
    alert('一场比赛仅可选择一种玩法，胜平负和让球可同时选择');
    return;
  }

  selectedMap[key] = true;
  refreshSelections();
}

function clearAllSelections() {
  for (const key of Object.keys(selectedMap)) {
    delete selectedMap[key];
  }
  refreshSelections();
}

function refreshSelections() {
  rebuildSelections();
  updateAvailableCombinations();
  recalc();
}

function rebuildSelections() {
  const newMatches = [];

  for (let dayIdx = 0; dayIdx < matchData.value.length; dayIdx += 1) {
    const day = matchData.value[dayIdx];
    for (let matchIdx = 0; matchIdx < (day.subMatchList || []).length; matchIdx += 1) {
      const match = day.subMatchList[matchIdx];
      const plays = [];

      for (const key of Object.keys(selectedMap)) {
        const [selectedDayIdx, selectedMatchIdx, playType, selectedOptionIdx] = key.split('-');
        if (Number(selectedDayIdx) !== dayIdx || Number(selectedMatchIdx) !== matchIdx) continue;

        const item = getOptionsForMatch(match, playType)[Number(selectedOptionIdx)];
        if (!item?.pv) continue;

        let typeDisplay = { sfp: '胜平负', zjq: '总进球', bqc: '半全场', bf: '比分' }[playType] || '未知';
        if (playType === 'sfp') {
          typeDisplay = item.isHandicap ? '让球' : '胜平负';
        }

        plays.push({
          type: typeDisplay,
          option: item.xuanxiangname,
          odds: Number.parseFloat(item.pv),
        });
      }

      if (plays.length) {
        newMatches.push({
          matchId: match.matchId,
          homeTeamAbbName: match.homeTeamAbbName,
          awayTeamAbbName: match.awayTeamAbbName,
          matchNum: match.matchNum,
          matchTime: match.matchTime,
          plays,
        });
      }
    }
  }

  userSelections.matches = newMatches;
}

function updateAvailableCombinations() {
  const maxN = Math.min(userSelections.matches.length, 8);
  availableCombinations.value = Array.from({ length: maxN }, (_, idx) => idx + 1);

  if (!availableCombinations.value.includes(selectedCombination.value)) {
    selectedCombination.value = availableCombinations.value.at(-1) || 1;
  }

  userSelections.combinations = [selectedCombination.value];
}

function onCombinationChange() {
  userSelections.combinations = [selectedCombination.value];
  recalc();
}

function recalc() {
  if (!userSelections.matches.length) {
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

watch(() => userSelections.betAmount, recalc);

onMounted(async () => {
  try {
    matchData.value = await fetchMatches();
    updateAvailableCombinations();
    recalc();
  } catch (error) {
    alert('数据加载失败，请检查网络或代理配置');
    console.error(error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

#app {
  display: flex;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  background: #f0f2f5;
  color: #1f2a3a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  text-align: left;
}

.left-panel {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 24px 448px 40px 28px;
  background: #f7f9fc;
}

.left-panel h2 {
  margin: 0 0 16px;
  padding-left: 14px;
  border-left: 5px solid #07c160;
  color: #1f2a3a;
  font-size: 24px;
  font-weight: 650;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  padding: 6px;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.tab-item {
  flex: 1;
  border: 0;
  border-radius: 6px;
  padding: 10px 0;
  background: transparent;
  color: #5a6a7a;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tab-item.active {
  background: #07c160;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(7, 193, 96, 0.3);
}

.tab-item:hover:not(.active) {
  background: #eef2f7;
}

.loading {
  padding: 60px 0;
  color: #8e9aaf;
  font-size: 16px;
  text-align: center;
}

.day-group {
  margin-bottom: 24px;
  border-radius: 8px;
  padding: 18px 20px;
  background: #ffffff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.day-title {
  margin-bottom: 16px;
  border-bottom: 1px solid #ebeff4;
  padding-bottom: 12px;
  color: #2c3e50;
  font-size: 17px;
  font-weight: 650;
}

.match-card {
  border-bottom: 1px solid #f2f4f8;
  padding: 14px 0;
}

.match-card:last-child {
  border-bottom: 0;
}

.match-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.league,
.match-num {
  border-radius: 6px;
  background: #e8edf4;
  color: #2c3e50;
  font-size: 12px;
}

.league {
  padding: 2px 14px;
  font-weight: 500;
}

.team {
  font-size: 16px;
  font-weight: 600;
}

.vs {
  color: #8e9aaf;
  font-size: 13px;
}

.match-num {
  padding: 1px 10px;
}

.match-time {
  margin-left: auto;
  color: #8e9aaf;
  font-size: 13px;
}

.handicap-badge {
  border: 1px solid #f5c27a;
  border-radius: 12px;
  padding: 2px 8px;
  background: #fff3e0;
  color: #d97706;
  font-size: 13px;
  font-weight: 650;
}

.odds-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.odd-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-label {
  border-radius: 6px;
  padding: 4px 8px;
  background: #f5f7fa;
  color: #5a6a7a;
  font-size: 12px;
}

.odd-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 62px;
  border: 1px solid #dde1e6;
  border-radius: 6px;
  padding: 6px 10px;
  background: #ffffff;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  transition: all 0.15s ease;
}

.odd-item:hover {
  border-color: #b0c4de;
  background: #f0f5ff;
  transform: translateY(-1px);
}

.odd-item.handicap {
  border-color: #f3d9b3;
  background: #fffaf0;
}

.odd-item.selected {
  border-color: #07c160;
  background: #07c160;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(7, 193, 96, 0.25);
}

.odd-badge {
  display: inline-block;
  margin-right: 5px;
  border-radius: 10px;
  padding: 1px 5px;
  background: #ffd8a8;
  color: #9a5600;
  font-size: 11px;
  font-weight: 650;
}

.odd-name {
  font-weight: 500;
}

.odd-value {
  margin-top: 1px;
  font-size: 15px;
  font-weight: 650;
}

.right-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  width: 420px;
  height: 100vh;
  overflow-y: auto;
  border-left: 1px solid #e4e8ed;
  padding: 24px 22px 30px;
  background: #ffffff;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.04);
}

.right-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.right-header h2 {
  margin: 0;
  color: #1f2a3a;
  font-size: 22px;
  font-weight: 650;
}

.clear-btn {
  border: 0;
  border-radius: 20px;
  padding: 6px 16px;
  background: #f0f2f5;
  color: #5a6a7a;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.clear-btn:hover {
  background: #ffebee;
  color: #e53935;
}

.selected-matches {
  min-height: 80px;
  margin-bottom: 16px;
  border: 1px solid #edf0f4;
  border-radius: 8px;
  padding: 14px;
  background: #fafbfc;
}

.empty-tip {
  padding: 20px 0;
  color: #8e9aaf;
  font-size: 14px;
  text-align: center;
}

.selected-match {
  margin-bottom: 10px;
  border-left: 3px solid #07c160;
  border-radius: 8px;
  padding: 10px 14px;
  background: #f1f8fe;
}

.selected-match:last-child {
  margin-bottom: 0;
}

.match-info,
.selected-options,
.control-row,
.result-item {
  display: flex;
}

.match-info {
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
}

.match-num-sm {
  color: #6b7a8d;
  font-weight: 400;
}

.selected-options {
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.option-tag {
  border-radius: 16px;
  padding: 2px 12px;
  background: #e8f0fe;
  color: #1f2a3a;
  font-size: 13px;
}

.controls {
  flex-shrink: 0;
  border-top: 1px solid #edf0f4;
  padding-top: 16px;
}

.control-row {
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.control-row label {
  flex-shrink: 0;
  width: 56px;
  font-size: 14px;
  font-weight: 500;
}

.control-row input,
.control-row select {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 8px 12px;
  background: #ffffff;
  font-size: 14px;
}

.control-row input:focus,
.control-row select:focus {
  border-color: #07c160;
  outline: 0;
  box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.1);
}

.control-row input {
  width: 80px;
}

.unit {
  color: #5a6a7a;
  font-size: 14px;
}

.result-box {
  margin-top: 6px;
  border-radius: 8px;
  padding: 16px 18px;
  background: #f7f9fc;
}

.result-item {
  justify-content: space-between;
  padding: 6px 0;
  font-size: 15px;
}

.result-item .label {
  color: #5a6a7a;
}

.result-item .value {
  font-weight: 650;
}

.result-item .highlight {
  color: #07c160;
}

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
  border-radius: 3px;
  background: #c4cdd8;
}

@media (max-width: 900px) {
  #app {
    display: block;
  }

  .left-panel {
    height: auto;
    overflow-y: visible;
    padding: 16px;
  }

  .right-panel {
    position: static;
    width: 100%;
    height: auto;
    overflow-y: visible;
    border-top: 1px solid #e4e8ed;
    border-left: 0;
    padding: 16px;
    box-shadow: none;
  }
}
</style>
