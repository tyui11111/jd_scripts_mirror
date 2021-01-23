/*
脚本：取关京东店铺和商品
更新时间：2020-11-22
因种豆得豆和宠汪汪以及NobyDa大佬的京东签到脚本会关注店铺和商品，故此脚本用来取消已关注的店铺和商品
默认每运行一次脚本取消关注10个商品，10个店铺。可结合boxjs自定义取消多少个（目前测试通过最大数量是一次性取消300个商品无异常，大于300请自行测试，建议尽量不要一次性全部取消以免出现问题）。
建议此脚本运行时间在 种豆得豆和宠汪汪脚本运行之后 再执行
现有功能: 1、取关商品。2、取关店铺。3、匹配到boxjs输入的过滤关键词后，不再进行此商品/店铺后面(包含输入的关键词商品/店铺)的取关。4、支持京东双账号
脚本兼容: Quantumult X, Surge, Loon, JSBox, Node.js, 小火箭
==============Quantumult X===========
[task_local]
#取关京东店铺商品
55 23 * * * https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_unsubscribe.js, tag=取关京东店铺商品, img-url=https://raw.githubusercontent.com/Orz-3/task/master/jd.png, enabled=true
===========Loon============
[Script]
cron "55 23 * * *" script-path=https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_unsubscribe.js,tag=取关京东店铺商品
============Surge=============
取关京东店铺商品 = type=cron,cronexp="55 23 * * *",wake-system=1,timeout=3600,script-path=https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_unsubscribe.js
===========小火箭========
取关京东店铺商品 = type=cron,script-path=https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_unsubscribe.js, cronexpr="55 23 * * *", timeout=3600, enable=true
 */
const $ = new Env('取关京东店铺和商品');
//Node.js用户请在jdCookie.js处填写京东ck;
const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
const notify = $.isNode() ? require('./sendNotify') : '';

//IOS等用户直接用NobyDa的jd cookie
let cookiesArr = [], cookie = '';
if ($.isNode()) {
  Object.keys(jdCookieNode).forEach((item) => {
    cookiesArr.push(jdCookieNode[item])
  })
  if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {};
} else {
  let cookiesData = $.getdata('CookiesJD') || "[]";
  cookiesData = jsonParse(cookiesData);
  cookiesArr = cookiesData.map(item => item.cookie);
  cookiesArr.reverse();
  cookiesArr.push(...[$.getdata('CookieJD2'), $.getdata('CookieJD')]);
  cookiesArr.reverse();
  cookiesArr = cookiesArr.filter(item => item !== "" && item !== null && item !== undefined);
}
const jdNotify = $.getdata('jdUnsubscribeNotify');//是否关闭通知，false打开通知推送，true关闭通知推送
let goodPageSize = $.getdata('jdUnsubscribePageSize') || 20;// 运行一次取消多少个已关注的商品。数字0表示不取关任何商品
let shopPageSize = $.getdata('jdUnsubscribeShopPageSize') || 20;// 运行一次取消多少个已关注的店铺。数字0表示不取关任何店铺
let stopGoods = $.getdata('jdUnsubscribeStopGoods') || '';//遇到此商品不再进行取关，此处内容需去商品详情页（自营处）长按拷贝商品信息
let stopShop = $.getdata('jdUnsubscribeStopShop') || '';//遇到此店铺不再进行取关，此处内容请尽量从头开始输入店铺名称
const JD_API_HOST = 'https://wq.jd.com/fav';
!(async () => {
  if (!cookiesArr[0]) {
    $.msg('【京东账号一】取关京东店铺商品失败', '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/bean/signIndex.action', {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});
  }
  for (let i = 0; i < cookiesArr.length; i++) {
    if (cookiesArr[i]) {
      cookie = cookiesArr[i];
      $.UserName = decodeURIComponent(cookie.match(/pt_pin=(.+?);/) && cookie.match(/pt_pin=(.+?);/)[1])
      $.index = i + 1;
      $.isLogin = true;
      $.nickName = '';
      await TotalBean();
      console.log(`\n开始【京东账号${$.index}】${$.nickName || $.UserName}\n`);
      if (!$.isLogin) {
        $.msg($.name, `【提示】cookie已失效`, `京东账号${$.index} ${$.nickName || $.UserName}\n请重新登录获取\nhttps://bean.m.jd.com/bean/signIndex.action`, {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});

        if ($.isNode()) {
          await notify.sendNotify(`${$.name}cookie已失效 - ${$.UserName}`, `京东账号${$.index} ${$.UserName}\n请重新登录获取cookie`);
        }
        continue
      }
      await requireConfig();
      await jdUnsubscribe();
      await showMsg();
    }
  }
})()
    .catch((e) => {
      $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
    })
    .finally(() => {
      $.done();
    })
async function jdUnsubscribe(doubleKey) {
  await Promise.all([
    unsubscribeGoods(doubleKey),
    unsubscribeShops()
  ])
  await Promise.all([
    getFollowShops(),
    getFollowGoods()
  ])
}
function showMsg() {
  if (!jdNotify || jdNotify === 'false') {
    $.msg($.name, ``, `【京东账号${$.index}】${$.nickName}\n【已取消关注店铺】${$.unsubscribeShopsCount}个\n【已取消关注商品】${$.unsubscribeGoodsCount}个\n【还剩关注店铺】${$.shopsTotalNum}个\n【还剩关注商品】${$.goodsTotalNum}个\n`);
  } else {
    $.log(`\n【京东账号${$.index}】${$.nickName}\n【已取消关注店铺】${$.unsubscribeShopsCount}个\n【已取消关注商品】${$.unsubscribeGoodsCount}个\n【还剩关注店铺】${$.shopsTotalNum}个\n【还剩关注商品】${$.goodsTotalNum}个\n`);
  }
}
function unsubscribeGoods() {
  return new Promise(async (resolve) => {
    let followGoods = await getFollowGoods();
    if (followGoods.iRet === '0') {
      let count = 0;
      $.unsubscribeGoodsCount = count;
      if ((goodPageSize * 1) !== 0) {
        if (followGoods.totalNum > 0) {
          for (let item of followGoods.data) {

            console.log(`是否匹配：：${item.commTitle.indexOf(stopGoods.replace(/\ufffc|\s*/g, ''))}`)

            if (stopGoods && item.commTitle.indexOf(stopGoods.replace(/\ufffc|\s*/g, '')) > -1) {
              console.log(`匹配到了您设定的商品--${stopGoods}，不在进行取消关注商品`)
              break;
            }
            let res = await unsubscribeGoodsFun(item.commId);
            // console.log('取消关注商品结果', res);
            if (res.iRet === 0 && res.errMsg === 'success') {
              console.log(`取消关注商品---${item.commTitle.substring(0, 20).concat('...')}---成功\n`)
              count ++;
            } else {
              console.log(`取消关注商品---${item.commTitle.substring(0, 20).concat('...')}---失败\n`)
            }
          }
          $.unsubscribeGoodsCount = count;
          resolve(count)
        } else {
          resolve(count)
        }
      } else {
        console.log(`\n您设置的是不取关商品\n`);
        resolve(count);
      }
    }
  })
}
function getFollowGoods() {
  return new Promise((resolve) => {
    const option = {
      url: `${JD_API_HOST}/comm/FavCommQueryFilter?cp=1&pageSize=${goodPageSize}&category=0&promote=0&cutPrice=0&coupon=0&stock=0&areaNo=1_72_4139_0&sceneval=2&g_login_type=1&callback=jsonpCBKB&g_ty=ls`,
      headers: {
        "Host": "wq.jd.com",
        "Accept": "*/*",
        "Connection": "keep-alive",
        "Cookie": cookie,
        "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
        "Accept-Language": "zh-cn",
        "Referer": "https://wqs.jd.com/my/fav/goods_fav.shtml?ptag=37146.4.1&sceneval=2&jxsid=15963530166144677970",
        "Accept-Encoding": "gzip, deflate, br"
      },
    }
    $.get(option, (err, resp, data) => {
      try {
        data = JSON.parse(data.slice(14, -13));
        $.goodsTotalNum = data.totalNum;
        // console.log('data', data.data.length)
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(data);
      }
    });
  })
}
function unsubscribeGoodsFun(commId) {
  return new Promise(resolve => {
    const option = {
      url: `${JD_API_HOST}/comm/FavCommDel?commId=${commId}&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKP&g_ty=ls`,
      headers: {
        "Host": "wq.jd.com",
        "Accept": "*/*",
        "Connection": "keep-alive",
        'User-Agent': $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
        'Referer': 'https://wqs.jd.com/my/fav/goods_fav.shtml?ptag=37146.4.1&sceneval=2&jxsid=15963530166144677970',
        'Cookie': cookie,
        "Accept-Language": "zh-cn",
        "Accept-Encoding": "gzip, deflate, br"
      },
    }
    $.get(option, (err, resp, data) => {
      try {
        data = JSON.parse(data.slice(14, -13).replace(',}', '}'));
        // console.log('data', data);
        // console.log('data', data.errMsg);
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(data);
      }
    });
  })
}

function unsubscribeShops() {
  return new Promise(async (resolve) => {
    let followShops = await getFollowShops();
    if (followShops.iRet === '0') {
      let count = 0;
      $.unsubscribeShopsCount = count;
      if ((shopPageSize * 1) !== 0) {
        if (followShops.totalNum > 0) {
          for (let item of followShops.data) {
            if (stopShop && (item.shopName && item.shopName.indexOf(stopShop.replace(/\s*/g, '')) > -1)) {
              console.log(`匹配到了您设定的店铺--${item.shopName}，不在进行取消关注店铺`)
              break;
            }
            let res = await unsubscribeShopsFun(item.shopId);
            // console.log('取消关注店铺结果', res);
            if (res.iRet === '0') {
              console.log(`取消已关注店铺---${item.shopName}----成功\n`)
              count ++;
            } else {
              console.log(`取消已关注店铺---${item.shopName}----失败\n`)
            }
          }
          $.unsubscribeShopsCount = count;
          resolve(count)
        } else {
          resolve(count)
        }
      } else {
        console.log(`\n您设置的是不取关店铺\n`);
        resolve(count)
      }
    }
  })
}
function getFollowShops() {
  return new Promise((resolve) => {
    const option = {
      url: `${JD_API_HOST}/shop/QueryShopFavList?cp=1&pageSize=${shopPageSize}&sceneval=2&g_login_type=1&callback=jsonpCBKA&g_ty=ls`,
      headers: {
        "Host": "wq.jd.com",
        "Accept": "*/*",
        "Connection": "keep-alive",
        "Cookie": cookie,
        "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
        "Accept-Language": "zh-cn",
        "Referer": "https://wqs.jd.com/my/fav/shop_fav.shtml?sceneval=2&jxsid=15963530166144677970&ptag=7155.1.9",
        "Accept-Encoding": "gzip, deflate, br"
      },
    }
    $.get(option, (err, resp, data) => {
      try {
        data = JSON.parse(data.slice(14, -13));
        $.shopsTotalNum = data.totalNum;
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(data);
      }
    });
  })
}
function unsubscribeShopsFun(shopId) {
  return new Promise(resolve => {
    const option = {
      url: `${JD_API_HOST}/shop/DelShopFav?shopId=${shopId}&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKG&g_ty=ls`,
      headers: {
        "Host": "wq.jd.com",
        "Accept": "*/*",
        "Connection": "keep-alive",
        'User-Agent': $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
        'Referer': 'https://wqs.jd.com/my/fav/shop_fav.shtml?sceneval=2&jxsid=15960121319555534107&ptag=7155.1.9',
        'Cookie': cookie,
        "Accept-Language": "zh-cn",
        "Accept-Encoding": "gzip, deflate, br"
      },
    }
    $.get(option, (err, resp, data) => {
      try {
        data = JSON.parse(data.slice(14, -13));
      } catch (e) {
        $.logErr(e, resp);
      } finally {
        resolve(data);
      }
    });
  })
}
function TotalBean() {
  return new Promise(async resolve => {
    const options = {
      "url": `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`,
      "headers": {
        "Accept": "application/json,text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-cn",
        "Connection": "keep-alive",
        "Cookie": cookie,
        "Referer": "https://wqs.jd.com/my/jingdou/my.shtml?sceneval=2",
        "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0")
      }
    }
    $.post(options, (err, resp, data) => {
      try {
        if (err) {
          console.log(`${JSON.stringify(err)}`)
          console.log(`${$.name} API请求失败，请检查网路重试`)
        } else {
          if (data) {
            data = JSON.parse(data);
            if (data['retcode'] === 13) {
              $.isLogin = false; //cookie过期
              return
            }
            $.nickName = data['base'].nickname;
          } else {
            console.log(`京东服务器返回空数据`)
          }
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        resolve();
      }
    })
  })
}
function requireConfig() {
  return new Promise(resolve => {
    if ($.isNode() && process.env.UN_SUBSCRIBES) {
      if (process.env.UN_SUBSCRIBES.indexOf('&') > -1) {
        $.UN_SUBSCRIBES = process.env.UN_SUBSCRIBES.split('&');
      } else if (process.env.UN_SUBSCRIBES.indexOf('\n') > -1) {
        $.UN_SUBSCRIBES = process.env.UN_SUBSCRIBES.split('\n');
      } else if (process.env.UN_SUBSCRIBES.indexOf('\\n') > -1) {
        $.UN_SUBSCRIBES = process.env.UN_SUBSCRIBES.split('\\n');
      } else {
        $.UN_SUBSCRIBES = process.env.UN_SUBSCRIBES.split();
      }
      console.log(`您secret设置的取关参数:\n${JSON.stringify($.UN_SUBSCRIBES)}`)
      goodPageSize = $.UN_SUBSCRIBES[0] || goodPageSize;
      shopPageSize = $.UN_SUBSCRIBES[1] || shopPageSize;
      stopGoods = $.UN_SUBSCRIBES[2] || stopGoods;
      stopShop = $.UN_SUBSCRIBES[3] || stopShop;
    }
    resolve()
  })
}
function jsonParse(str) {
  if (typeof str == "string") {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.log(e);
      $.msg($.name, '', '请勿随意在BoxJs输入框修改内容\n建议通过脚本去获取cookie')
      return [];
    }
  }
}
// prettier-ignore
function Env(t,s){return new class{constructor(t,s){this.name=t,this.data=null,this.dataFile="box.dat",this.logs=[],this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,s),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}getScript(t){return new Promise(s=>{$.get({url:t},(t,e,i)=>s(i))})}runScript(t,s){return new Promise(e=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=s&&s.timeout?s.timeout:o;const[h,a]=i.split("@"),r={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:o},headers:{"X-Key":h,Accept:"*/*"}};$.post(r,(t,s,i)=>e(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s);if(!e&&!i)return{};{const i=e?t:s;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s),o=JSON.stringify(this.data);e?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(s,o):this.fs.writeFileSync(t,o)}}lodash_get(t,s,e){const i=s.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return e;return o}lodash_set(t,s,e){return Object(t)!==t?t:(Array.isArray(s)||(s=s.toString().match(/[^.[\]]+/g)||[]),s.slice(0,-1).reduce((t,e,i)=>Object(t[e])===t[e]?t[e]:t[e]=Math.abs(s[i+1])>>0==+s[i+1]?[]:{},t)[s[s.length-1]]=e,t)}getdata(t){let s=this.getval(t);if(/^@/.test(t)){const[,e,i]=/^@(.*?)\.(.*?)$/.exec(t),o=e?this.getval(e):"";if(o)try{const t=JSON.parse(o);s=t?this.lodash_get(t,i,""):s}catch(t){s=""}}return s}setdata(t,s){let e=!1;if(/^@/.test(s)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(s),h=this.getval(i),a=i?"null"===h?null:h||"{}":"{}";try{const s=JSON.parse(a);this.lodash_set(s,o,t),e=this.setval(JSON.stringify(s),i)}catch(s){const h={};this.lodash_set(h,o,t),e=this.setval(JSON.stringify(h),i)}}else e=$.setval(t,s);return e}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,s){return this.isSurge()||this.isLoon()?$persistentStore.write(t,s):this.isQuanX()?$prefs.setValueForKey(t,s):this.isNode()?(this.data=this.loaddata(),this.data[s]=t,this.writedata(),!0):this.data&&this.data[s]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,s=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?$httpClient.get(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)}):this.isQuanX()?$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,s)=>{try{const e=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(e,null),s.cookieJar=this.ckjar}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)))}post(t,s=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),delete t.headers["Content-Length"],this.isSurge()||this.isLoon())$httpClient.post(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)});else if(this.isQuanX())t.method="POST",$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t));else if(this.isNode()){this.initGotEnv(t);const{url:e,...i}=t;this.got.post(e,i).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t))}}time(t){let s={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in s)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?s[e]:("00"+s[e]).substr((""+s[e]).length)));return t}msg(s=t,e="",i="",o){const h=t=>!t||!this.isLoon()&&this.isSurge()?t:"string"==typeof t?this.isLoon()?t:this.isQuanX()?{"open-url":t}:void 0:"object"==typeof t&&(t["open-url"]||t["media-url"])?this.isLoon()?t["open-url"]:this.isQuanX()?t:void 0:void 0;this.isSurge()||this.isLoon()?$notification.post(s,e,i,h(o)):this.isQuanX()&&$notify(s,e,i,h(o)),this.logs.push("","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="),this.logs.push(s),e&&this.logs.push(e),i&&this.logs.push(i)}log(...t){t.length>0?this.logs=[...this.logs,...t]:console.log(this.logs.join(this.logSeparator))}logErr(t,s){const e=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();e?$.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):$.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(s=>setTimeout(s,t))}done(t={}){const s=(new Date).getTime(),e=(s-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${e} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,s)}
