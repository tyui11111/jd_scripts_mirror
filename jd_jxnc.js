/*
特别声明：
本脚本搬运自 https://github.com/whyour/hundun/blob/master/quanx/jx_nc.js
感谢 @whyour 大佬

京喜农场:脚本更新地址 https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_jxnc.js
更新时间：2021-01-10 22:47:51
东东农场活动链接：https://wqsh.jd.com/sns/201912/12/jxnc/detail.html?ptag=7155.9.32&smp=b47f4790d7b2a024e75279f55f6249b9&active=jdnc_1_chelizi1205_2
已支持IOS双京东账号,Node.js支持N个京东账号
理论上脚本兼容: QuantumultX, Surge, Loon, JSBox, Node.js
助力码shareCode请先手动运行脚本查看打印可看到

hostname = wq.jd.com

==========================Quantumultx=========================
[task_local]
0 9,12,18 * * * https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_jxnc.js, tag=京喜农场, img-url=https://raw.githubusercontent.com/58xinian/icon/master/jxnc.png, enabled=true
[rewrite_local]
^https\:\/\/wq\.jd\.com\/cubeactive\/farm\/dotask url script-request-header https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_nc.cookie.js
=========================Loon=============================
[Script]
http-request ^https\:\/\/wq\.jd\.com\/cubeactive\/farm\/dotask script-path=https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_nc.cookie.js, requires-body=false, timeout=3600, tag=京喜农场cookie
cron "0 9,12,18 * * *" script-path=https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_jxnc.js,tag=京喜农场

=========================Surge============================
京喜农场 = type=cron,cronexp="0 9,12,18 * * *",timeout=3600,script-path=https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_jxnc.js
京喜农场cookie = type=http-request,pattern=^https\:\/\/wq\.jd\.com\/cubeactive\/farm\/dotask,requires-body=0,max-size=0,script-path= https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_nc.cookie.js
 
=========================小火箭===========================
京喜农场 = type=cron,script-path=https://raw.githubusercontent.com/LXK9301/jd_scripts/master/jd_jxnc.js, cronexpr="0 9,12,18 * * *", timeout=3600, enable=true
京喜农场APP种子cookie = type=http-request,script-path=https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_nc.cookie.js,pattern=^https\:\/\/wq\.jd\.com\/cubeactive\/farm\/dotask,max-size=131072,timeout=3600,enable=true

特别说明：
脚本运行必须填写种子token，iOS用户使用代理可以直接获取；Android用户需要抓包获取种子token，手动做京喜农场任意任务即可获取种子token，推荐使用elecV2P（使用设置类似iOS用户的代理软件）或者HttpCanary，搜索关键字"farm_jstoken"，token按照{"farm_jstoken":"xxx","timestamp":"xxx","phoneid":"xxx-xxx"}格式填写即可

*/

const $ = new Env('京喜农场');
let notify = ''; // nodejs 发送通知脚本
let notifyLevel = $.isNode() ? process.env.JXNC_NOTIFY_LEVEL || 3 : 3; // 通知级别 0=不通知;1=本次获得水滴>0;2=任务执行;3=任务执行+未种植种子;
let notifyBool = true; // 代码内部使用，控制是否通知
let cookieArr = []; // 用户 cookie 数组
let currentCookie = ''; // 当前用户 cookie
let tokenNull = {'farm_jstoken': '', 'phoneid': '', 'timestamp': ''}; // 内置一份空的 token
let tokenArr = []; // 用户 token 数组
let currentToken = {}; // 当前用户 token
const shareCode = '22bd6fbbabbaa770a45ab2607e7a1e8a@197c6094e965fdf3d33621b47719e0b1'; // 内置助力码
let jxncShareCodeArr = []; // 用户 助力码 数组
let currentShareCode = []; // 当前用户 要助力的助力码
const openUrl = `openjd://virtual?params=${encodeURIComponent('{ "category": "jump", "des": "m", "url": "https://wqsh.jd.com/sns/201912/12/jxnc/detail.html?ptag=7155.9.32&smp=b47f4790d7b2a024e75279f55f6249b9&active=jdnc_1_chelizi1205_2"}',)}`; // 打开京喜农场
let subTitle = '', message = '', option = {'open-url': openUrl}; // 消息副标题，消息正文，消息扩展参数
const JXNC_API_HOST = 'https://wq.jd.com/';

$.detail = []; // 今日明细列表
$.helpTask = null;
$.allTask = []; // 任务列表
$.info = {}; // 用户信息
$.answer = 3;
$.drip = 0;
$.maxHelpNum = $.isNode() ? 8 : 3; // 助力 ret 1011 错误最大计数
$.helpNum = 0; // 当前账号 助力 ret 1011 次数
$.maxHelpSelfNum = 3; // 助力 自身 ret 1021 cannot help self 最大次数限制（防止随机API不停返回自身 code 导致死循环）
$.helpSelfNum = 0; // 当前账号 助力 ret 1021 cannot help self 次数
let assistUserShareCode = 0; // 随机助力用户 share code

!(async () => {
    await requireConfig();
    if (!cookieArr[0]) {
        $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/bean/signIndex.action', {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});
        return;
    }

    for (let i = 0; i < cookieArr.length; i++) {
        if (cookieArr[i]) {
            currentCookie = cookieArr[i];
            $.UserName = decodeURIComponent(currentCookie.match(/pt_pin=(.+?);/) && currentCookie.match(/pt_pin=(.+?);/)[1])
            $.index = i + 1;
            $.isLogin = true;
            $.nickName = '';
            $.log(`\n************* 检查【京东账号${$.index}】${$.UserName} cookie 是否有效 *************`);
            await TotalBean();
            $.log(`开始【京东账号${$.index}】${$.nickName || $.UserName}\n`);
            if (!$.isLogin) {
                $.msg($.name, `【提示】cookie已失效`, `京东账号${$.index} ${$.nickName || $.UserName}\n请重新登录获取\nhttps://bean.m.jd.com/`, {"open-url": "https://bean.m.jd.com/"});
                if ($.isNode()) {
                    await notify.sendNotify(`${$.name}cookie已失效 - ${$.UserName}`, `京东账号${$.index} ${$.UserName}\n请重新登录获取cookie`);
                }
                continue
            }
            subTitle = '';
            message = '';
            option = {};
            $.answer = 3;
            $.helpNum = 0;
            $.helpSelfNum = 0;
            notifyBool = notifyLevel > 0; // 初始化是否推送
            await tokenFormat(); // 处理当前账号 token
            await shareCodesFormat(); // 处理当前账号 助力码
            await jdJXNC(); // 执行当前账号 主代码流程
        }
    }
})()
    .catch((e) => {
        $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
        console.log(e);
    })
    .finally(() => {
        $.done();
    })

// 加载配置 cookie token shareCode
function requireConfig() {
    return new Promise(resolve => {
        $.log('开始获取配置文件\n')
        notify = $.isNode() ? require('./sendNotify') : '';
        //Node.js用户请在jdCookie.js处填写京东ck;
        const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
        const jdTokenNode = $.isNode() ? require('./jdJxncTokens.js') : '';
        const jdJxncShareCodeNode = $.isNode() ? require('./jdJxncShareCodes.js') : '';
        //IOS等用户直接用NobyDa的jd cookie
        if ($.isNode()) {
            Object.keys(jdCookieNode).forEach((item) => {
                if (jdCookieNode[item]) {
                    cookieArr.push(jdCookieNode[item]);
                }
            })
            if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {
            };
        } else {
            cookieArr.push(...[$.getdata('CookieJD'), $.getdata('CookieJD2')]);
        }

        $.log(`共${cookieArr.length}个京东账号\n`);

        if ($.isNode()) {
            Object.keys(jdTokenNode).forEach((item) => {
                tokenArr.push(jdTokenNode[item] ? JSON.parse(jdTokenNode[item]) : tokenNull)
            })
        } else {
            tokenArr.push(...[$.getdata('jxnc_token1') || tokenNull, $.getdata('jxnc_token2') || tokenNull]);
        }

        if ($.isNode()) {
            Object.keys(jdJxncShareCodeNode).forEach((item) => {
                if (jdJxncShareCodeNode[item]) {
                    jxncShareCodeArr.push(jdJxncShareCodeNode[item])
                }
            })
        }

        // console.log(`jdFruitShareArr::${JSON.stringify(jdFruitShareArr)}`)
        // console.log(`jdFruitShareArr账号长度::${jdFruitShareArr.length}`)
        $.log(`您提供了${jxncShareCodeArr.length}个账号的京喜农场助力码`);
        resolve()
    })
}

// 查询京东账户信息（检查 cookie 是否有效）
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
                "Cookie": currentCookie,
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

// 处理当前账号token
function tokenFormat() {
    return new Promise(async resolve => {
        if (tokenArr[$.index - 1] && tokenArr[$.index - 1].farm_jstoken) {
            currentToken = tokenArr[$.index - 1];
        } else {
            currentToken = tokenNull;
        }
        resolve();
    })
}

// 处理当前账号助力码
function shareCodesFormat() {
    return new Promise(async resolve => {
        // console.log(`第${$.index}个京东账号的助力码:::${jdFruitShareArr[$.index - 1]}`)
        if (jxncShareCodeArr[$.index - 1]) {
            currentShareCode = jxncShareCodeArr[$.index - 1].split('@');
            currentShareCode.push(...(shareCode.split('@')));
        } else {
            $.log(`由于您第${$.index}个京东账号未提供shareCode,将采纳本脚本自带的助力码`)
            currentShareCode = shareCode.split('@');
        }
        $.log(`第${$.index}个京东账号将要助力的好友${JSON.stringify(currentShareCode)}`)
        resolve();
    })
}

async function jdJXNC() {
    subTitle = `【京东账号${$.index}】${$.nickName}`;
    $.log(`获取用户信息 & 任务列表`);
    const startInfo = await getTaskList();
    if (startInfo.prizename) {
        message += `【水果名称】${startInfo.prizename}\n`;
    }
    if (startInfo) {
        $.log(`【京东账号${$.index}（${$.nickName || $.UserName}）的${$.name}好友互助码】 ${$.info.smp}`);
        $.log(`【京东账号${$.index}（${$.nickName || $.UserName}）的${$.name}种子active】 ${$.info.active}`);
        await $.wait(500);
        const isOk = await browserTask();
        if (isOk) {
            await $.wait(500);
            await answerTask();
            await $.wait(500);
            const endInfo = await getTaskList();
            getMessage(endInfo, startInfo);
            await submitInviteId($.UserName);
            await $.wait(500);
            let next = await helpFriends();
            if (next) {
                while (true) {
                    assistUserShareCode = await getAssistUser();
                    if (assistUserShareCode) {
                        await $.wait(300);
                        next = await helpShareCode(assistUserShareCode);
                        if (next) {
                            await $.wait(200);
                            continue;
                        }
                    }
                    break;
                }
            }
        }
    }
    await showMsg()
}

// 获取任务列表与用户信息
function getTaskList() {
    return new Promise(async resolve => {
        $.get(taskUrl('query', `type=1`), async (err, resp, data) => {
            try {
                const res = data.match(/try\{whyour\(([\s\S]*)\)\;\}catch\(e\)\{\}/)[1];
                const {detail, msg, task = [], retmsg, ...other} = JSON.parse(res);
                $.detail = detail;
                $.helpTask = task.filter(x => x.tasktype === 2)[0] || {eachtimeget: 0, limit: 0};
                $.allTask = task.filter(x => x.tasktype !== 3 && x.tasktype !== 2 && parseInt(x.left) > 0);
                $.info = other;
                $.log(`获取任务列表 ${retmsg} 总共${$.allTask.length}个任务！`);
                if (!$.info.active) {
                    $.log('账号未选择种子，请先去京喜农场选择种子。\n如果选择 APP 专属种子，必须提供 token。');
                    message += '账号未选择种子，请先去京喜农场选择种子。\n如果选择 APP 专属种子，必须提供 token。\n';
                    notifyBool = notifyBool && notifyLevel >= 3;
                    resolve(false);
                }
                resolve(other);
            } catch (e) {
                $.logErr(e, resp);
            } finally {
                resolve(true);
            }
        });
    });
}

function browserTask() {
    return new Promise(async resolve => {
        const tasks = $.allTask.filter(x => x.tasklevel !== 6);
        const times = Math.max(...[...tasks].map(x => x.limit));
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            $.log(`开始第${i + 1}个任务：${task.taskname}`);
            const status = [0];
            for (let i = 0; i < times; i++) {
                const random = Math.random() * 3;
                await $.wait(random * 1000);
                if (status[0] === 0) {
                    status[0] = await doTask(task);
                }
                if (status[0] !== 0) {
                    break;
                }
            }
            if (status[0] === 1017) { // ret:1017 retmsg:"score full" 水滴已满，果实成熟，跳过所有任务
                $.log('水滴已满，果实成熟，跳过所有任务');
                resolve(true);
                break;
            }
            if (status[0] === 1032) {
                $.log('任务执行失败，种植的 APP 专属种子，请提供 token 或种植非 APP 种子');
                message += '任务执行失败，种植的 APP 专属种子，请提供 token 或种植非 APP 种子\n';
                notifyBool = notifyBool && notifyLevel >= 2;
                resolve(false);
                return;
            }

            $.log(`结束第${i + 1}个任务：${task.taskname}`);
        }
        resolve(true);
    });
}

function answerTask() {
    const _answerTask = $.allTask.filter(x => x.tasklevel === 6);
    if (!_answerTask || !_answerTask[0]) return;
    const {tasklevel, left, taskname, eachtimeget} = _answerTask[0];
    $.log(`准备做答题任务：${taskname}`);
    return new Promise(async resolve => {
        if (parseInt(left) <= 0) {
            resolve(false);
            $.log(`${taskname}[做任务]： 任务已完成，跳过`);
            return;
        }
        $.get(
            taskUrl(
                'dotask',
                `active=${$.info.active}&answer=${$.info.indexday}:${['A', 'B', 'C', 'D'][$.answer]}:0&joinnum=${
                    $.info.joinnum
                }&tasklevel=${tasklevel}`,
            ),
            async (err, resp, data) => {
                try {
                    const res = data.match(/try\{whyour\(([\s\S]*)\)\;\}catch\(e\)\{\}/)[1];
                    let {ret, retmsg, right} = JSON.parse(res);
                    retmsg = retmsg !== '' ? retmsg : '成功';
                    $.log(`${taskname}[做任务]：ret:${ret} retmsg:"${retmsg.indexOf('活动太火爆了') !== -1 ? '任务进行中或者未到任务时间' : retmsg}"`);
                    if (ret === 0 && right === 1) {
                        $.drip += eachtimeget;
                    }
                    if (ret === 1017) { // ret:1017 retmsg:"score full" 水滴已满，果实成熟，跳过答题
                        resolve();
                        return;
                    }
                    if (((ret !== 0 && ret !== 1029) || retmsg === 'ans err') && $.answer > 0) {
                        $.answer--;
                        await $.wait(1000);
                        await answerTask();
                    }
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve();
                }
            },
        );
    });
}

function getMessage(endInfo, startInfo) {
    const need = endInfo.target - endInfo.score;
    const get = endInfo.modifyscore; // 本次变更获得水滴
    const leaveGet = startInfo.modifyscore; // 离开时获得水滴
    let dayGet = 0; // 今日共获取水滴数
    if ($.detail) {
        let dayTime = new Date(new Date().toLocaleDateString()).getTime() / 1000; // 今日 0 点时间戳（10位数）
        $.detail.forEach(function (item, index) {
            if (item.time >= dayTime && item.score) {
                dayGet += item.score;
            }
        });
    }
    message += `【水滴】本次获得${get} 离线获得${leaveGet} 今日获得${dayGet} 还需水滴${need}\n`;
    if (need <= 0) {
        notifyBool = true;
        message += `【成熟】水果已成熟请及时收取\n`;
        return;
    }
    if (get > 0 || leaveGet > 0 || dayGet > 0) {
        const day = Math.ceil(need / (dayGet > 0 ? dayGet : (get + leaveGet)));
        message += `【预测】还需 ${day} 天\n`;
    }
    if (get > 0 || leaveGet > 0) { // 本次 或 离线 有水滴
        notifyBool = notifyBool && notifyLevel >= 1;
    } else {
        notifyBool = notifyBool && notifyLevel >= 2;
    }
}

// 提交助力码
function submitInviteId(userName) {
    return new Promise(resolve => {
        if (!$.info || !$.info.smp) {
            resolve();
            return;
        }
        try {
            $.post(
                {
                    url: `https://api.ninesix.cc/api/jx-nc/${$.info.smp}/${encodeURIComponent(userName)}?active=${$.info.active}`,
                    timeout: 10000
                },
                (err, resp, _data) => {
                    try {
                        const {code, data = {}} = JSON.parse(_data);
                        $.log(`邀请码提交：${code}`);
                        if (data.value) {
                            message += '【邀请码】提交成功！\n';
                        }
                    } catch (e) {
                        // $.logErr(e, resp);
                        $.log('邀请码提交失败 API 返回异常');
                    } finally {
                        resolve();
                    }
                },
            );
        } catch (e) {
            // $.logErr(e, resp);
            resolve();
        }
    });
}

function getAssistUser() {
    return new Promise(resolve => {
        try {
            $.get({url: `https://api.ninesix.cc/api/jx-nc?active=${$.info.active}`, timeout: 10000}, async (err, resp, _data) => {
                try {
                    const {code, data = {}} = JSON.parse(_data);
                    if (data.value) {
                        $.log(`获取随机助力码成功 ${code} ${data.value}`);
                        resolve(data.value);
                    } else {
                        $.log(`获取随机助力码失败 ${code}`);
                    }
                } catch (e) {
                    // $.logErr(e, resp);
                    $.log('获取随机助力码失败 API 返回异常');
                } finally {
                    resolve(false);
                }
            });
        } catch (e) {
            // $.logErr(e, resp);
            resolve(false);
        }
    });
}

// 为好友助力 return true 继续助力  false 助力结束
async function helpFriends() {
    for (let code of currentShareCode) {
        if (!code) {
            continue
        }
        const next = await helpShareCode(code);
        if (!next) {
            return false;
        }
    }
    return true;
}

// 执行助力 return true 继续助力  false 助力结束
function helpShareCode(code) {
    return new Promise(async resolve => {
        if (code === $.info.smp) { // 自己的助力码，跳过，继续执行
            $.log('助力码与当前账号相同，跳过助力。准备进行下一个助力');
            resolve(true);
        }
        $.log(`即将助力 share code：${code}`);
        $.get(
            taskUrl('help', `active=${$.info.active}&joinnum=${$.info.joinnum}&smp=${code}`),
            async (err, resp, data) => {
                try {
                    const res = data.match(/try\{whyour\(([\s\S]*)\)\;\}catch\(e\)\{\}/)[1];
                    const {ret, retmsg = ''} = JSON.parse(res);
                    $.log(`助力结果：ret=${ret} retmsg="${retmsg ? retmsg : 'OK'}"`);
                    if (ret === 0) { // 0 助力成功
                        resolve(true);
                    }
                    if (ret === 1021) { // 1021 cannot help self 不能助力自己
                        $.helpSelfNum++;
                        if ($.helpSelfNum <= $.maxHelpSelfNum) {
                            resolve(true);
                        }
                    }
                    if (ret === 1011) { // 1011 active 不同
                        $.helpNum++;
                        if ($.helpNum <= $.maxHelpNum) {
                            resolve(true);
                        }
                    }
                    // ret 1016 助力上限
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve(false);
                }
            },
        );
    });
}


function doTask({tasklevel, left, taskname, eachtimeget}) {
    return new Promise(async resolve => {
        if (parseInt(left) <= 0) {
            $.log(`${taskname}[做任务]： 任务已完成，跳过`);
            resolve(false);
        }
        $.get(
            taskUrl(
                'dotask',
                `active=${$.info.active}&answer=${$.info.indexday}:D:0&joinnum=${$.info.joinnum}&tasklevel=${tasklevel}`,
            ),
            (err, resp, data) => {
                try {
                    const res = data.match(/try\{whyour\(([\s\S]*)\)\;\}catch\(e\)\{\}/)[1];
                    let {ret, retmsg} = JSON.parse(res);
                    retmsg = retmsg !== '' ? retmsg : '成功';
                    $.log(`${taskname}[做任务]：ret:${ret} retmsg:"${retmsg.indexOf('活动太火爆了') !== -1 ? '任务进行中或者未到任务时间' : retmsg}"`);
                    if (ret === 0) {
                        $.drip += eachtimeget;
                    }
                    resolve(ret);
                } catch (e) {
                    $.logErr(e, resp);
                } finally {
                    resolve();
                }
            },
        );
    });
}

function taskUrl(function_path, body) {
    return {
        url: `${JXNC_API_HOST}cubeactive/farm/${function_path}?${body}&farm_jstoken=${currentToken['farm_jstoken']}&phoneid=${currentToken['phoneid']}&timestamp=${currentToken['timestamp']}&sceneval=2&g_login_type=1&callback=whyour&_=${Date.now()}&g_ty=ls`,
        headers: {
            Cookie: currentCookie,
            Accept: `*/*`,
            Connection: `keep-alive`,
            Referer: `https://st.jingxi.com/pingou/dream_factory/index.html`,
            'Accept-Encoding': `gzip, deflate, br`,
            Host: `wq.jd.com`,
            'Accept-Language': `zh-cn`,
        },
        timeout: 10000,
    };
}

async function showMsg() {
    if (notifyBool) {
        $.msg($.name, subTitle, message, option);
        if ($.isNode()) {
            await notify.sendNotify(`${$.name} - 账号${$.index} - ${$.nickName}`, `${subTitle}\n${message}`);
        }
    } else {
        $.log(`${$.name} - notify 通知已关闭\n账号${$.index} - ${$.nickName}\n${subTitle}\n${message}`);
    }
}

// prettier-ignore
function Env(t,s){return new class{constructor(t,s){this.name=t,this.data=null,this.dataFile="box.dat",this.logs=[],this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,s),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}getScript(t){return new Promise(s=>{$.get({url:t},(t,e,i)=>s(i))})}runScript(t,s){return new Promise(e=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=s&&s.timeout?s.timeout:o;const[h,a]=i.split("@"),r={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:o},headers:{"X-Key":h,Accept:"*/*"}};$.post(r,(t,s,i)=>e(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s);if(!e&&!i)return{};{const i=e?t:s;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),s=this.path.resolve(process.cwd(),this.dataFile),e=this.fs.existsSync(t),i=!e&&this.fs.existsSync(s),o=JSON.stringify(this.data);e?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(s,o):this.fs.writeFileSync(t,o)}}lodash_get(t,s,e){const i=s.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return e;return o}lodash_set(t,s,e){return Object(t)!==t?t:(Array.isArray(s)||(s=s.toString().match(/[^.[\]]+/g)||[]),s.slice(0,-1).reduce((t,e,i)=>Object(t[e])===t[e]?t[e]:t[e]=Math.abs(s[i+1])>>0==+s[i+1]?[]:{},t)[s[s.length-1]]=e,t)}getdata(t){let s=this.getval(t);if(/^@/.test(t)){const[,e,i]=/^@(.*?)\.(.*?)$/.exec(t),o=e?this.getval(e):"";if(o)try{const t=JSON.parse(o);s=t?this.lodash_get(t,i,""):s}catch(t){s=""}}return s}setdata(t,s){let e=!1;if(/^@/.test(s)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(s),h=this.getval(i),a=i?"null"===h?null:h||"{}":"{}";try{const s=JSON.parse(a);this.lodash_set(s,o,t),e=this.setval(JSON.stringify(s),i)}catch(s){const h={};this.lodash_set(h,o,t),e=this.setval(JSON.stringify(h),i)}}else e=$.setval(t,s);return e}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,s){return this.isSurge()||this.isLoon()?$persistentStore.write(t,s):this.isQuanX()?$prefs.setValueForKey(t,s):this.isNode()?(this.data=this.loaddata(),this.data[s]=t,this.writedata(),!0):this.data&&this.data[s]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,s=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?$httpClient.get(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)}):this.isQuanX()?$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,s)=>{try{const e=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();this.ckjar.setCookieSync(e,null),s.cookieJar=this.ckjar}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t)))}post(t,s=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),delete t.headers["Content-Length"],this.isSurge()||this.isLoon())$httpClient.post(t,(t,e,i)=>{!t&&e&&(e.body=i,e.statusCode=e.status),s(t,e,i)});else if(this.isQuanX())t.method="POST",$task.fetch(t).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t));else if(this.isNode()){this.initGotEnv(t);const{url:e,...i}=t;this.got.post(e,i).then(t=>{const{statusCode:e,statusCode:i,headers:o,body:h}=t;s(null,{status:e,statusCode:i,headers:o,body:h},h)},t=>s(t))}}time(t){let s={"M+":(new Date).getMonth()+1,"d+":(new Date).getDate(),"H+":(new Date).getHours(),"m+":(new Date).getMinutes(),"s+":(new Date).getSeconds(),"q+":Math.floor(((new Date).getMonth()+3)/3),S:(new Date).getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,((new Date).getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in s)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?s[e]:("00"+s[e]).substr((""+s[e]).length)));return t}msg(s=t,e="",i="",o){const h=t=>!t||!this.isLoon()&&this.isSurge()?t:"string"==typeof t?this.isLoon()?t:this.isQuanX()?{"open-url":t}:void 0:"object"==typeof t&&(t["open-url"]||t["media-url"])?this.isLoon()?t["open-url"]:this.isQuanX()?t:void 0:void 0;this.isSurge()||this.isLoon()?$notification.post(s,e,i,h(o)):this.isQuanX()&&$notify(s,e,i,h(o)),this.logs.push("","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="),this.logs.push(s),e&&this.logs.push(e),i&&this.logs.push(i)}log(...t){t.length>0?this.logs=[...this.logs,...t]:console.log(this.logs.join(this.logSeparator))}logErr(t,s){const e=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();e?$.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):$.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(s=>setTimeout(s,t))}done(t={}){const s=(new Date).getTime(),e=(s-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${e} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,s)}
