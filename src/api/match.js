import axios from 'axios';

export async function fetchMatches() {
  const url = 'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=&channel=c';

  try {
    const res = await axios.get(url);
    const matchInfoList = res.data?.value?.matchInfoList;

    if (Array.isArray(matchInfoList)) {
      console.log('成功获取比赛列表，共', matchInfoList.length, '个日期分组');
      return matchInfoList;
    }

    console.error('数据格式异常，未找到 matchInfoList:', res.data);
    return [];
  } catch (error) {
    console.error('fetchMatches error:', error);
    throw error;
  }
}
