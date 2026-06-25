import axios from 'axios';

export async function fetchMatches() {
  const url = 'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=&channel=c';
  try {
    const res = await axios.get(url);
    console.log('fetchMatches 完整响应:', res.data);
    // 检查数据结构
    if (res.data && res.data.value && Array.isArray(res.data.value.matchInfoList)) {
      console.log('✅ 成功获取比赛列表，共', res.data.value.matchInfoList.length, '个日期分组');
      return res.data.value.matchInfoList;
    } else {
      console.error('❌ 数据格式异常，未找到 matchInfoList:', res.data);
      // 返回空数组，避免 undefined
      return [];
    }
  } catch (error) {
    console.error('❌ fetchMatches error:', error);
    throw error;
  }
}