import {Injectable} from "@angular/core";
import {isNull, isNullOrUndefined} from "util";
import {areaJSON} from "./area";
import {AjaxService} from "./ajax.service";
import {ToasterService} from "angular2-toaster";
import {TranslateService} from "@ngx-translate/core";
import {SettingsService} from "../settings/settings.service";
import * as moment from 'moment-timezone';

declare var $: any;
const swal = require('sweetalert');

@Injectable()
export class RzhtoolsService {

  private areaJson: any;
  private enumData = {};
  private timezones: Array<any> = new Array();//时区信息
  private countryCode: Array<any> = new Array();//时区信息
  upperClassLimit: number; //学员上限

  // Angular2框架负责注入对象
  constructor(private ajax: AjaxService, private toaster: ToasterService, public translate: TranslateService) {
    this.areaJson = areaJSON;
  }

  /**
   * 身份证信息识别
   * @param idCard
   * @returns {*}
   */
  public identify(idCard: string) {
    let isTrue = false;
    let info = '身份证号格式错误';      //返回结果中的提示信息
    let resultMap = new Map();    //返回map对象
    let resultMapData = new Map();  //map对象中返回数据

    if (!isNull(idCard)) {
      idCard = idCard.toString(); //转化为字符串

      isTrue = this.verify(idCard);    //验证身份证号的正确性

      //15位身份证转17位身份证
      if (idCard.length == 15) {
        idCard = this.card15To17(idCard);
      }

      if (isTrue) {
        let areaCode, birthday, sex;
        areaCode = idCard.substr(0, 6);//行政区域代码
        birthday = idCard.substr(6, 8);//出生日期，如20170602
        birthday = birthday.substr(0, 4) + '-' + birthday.substr(4, 2) + '-' + birthday.substr(6);
        sex = Number.parseInt(idCard.substr(16, 1)) % 2 == 0 ? 0 : 1;//性别[奇(1 男)、偶(0 女)]，取出第17位判断奇偶
        resultMapData.set('areaCode', areaCode);
        resultMapData.set('birthday', birthday);
        resultMapData.set('sex', sex);
        info = '身份证号格式正确';
      }
    }
    resultMap.set('success', isTrue);
    resultMap.set('info', info);
    resultMap.set('data', resultMapData);
    return resultMap;
  };

  /**
   * 身份证验证
   * @param idCard
   * @returns {boolean}
   */
  public verify(idCard: string) {
    if (isNull(idCard)) return false;
    idCard = idCard.toString(); //转化为字符串

    //第18位校验码，余数对应正确的末尾数字
    const checkCodeMap = {
      '0': '1',
      '1': '0',
      '2': 'Xx',
      '3': '9',
      '4': '8',
      '5': '7',
      '6': '6',
      '7': '5',
      '8': '4',
      '9': '3',
      '10': '2'
    };

    if (idCard.length != 15 && idCard.length != 18) {
      return false;
    }
    //验证填写区域地址是否存在
    let areaObj = this.getAreaByCode(idCard.substr(0, 6), true);
    if (isNull(areaObj)) return false;

    let isOldCard = false;
    //15位身份证转17位身份证，因为15位身份证号没有检验码（像18位身份证号中最后一位），所以不对15位身份证号做详细校验
    if (idCard.length == 15) {
      idCard = this.card15To17(idCard);
      isOldCard = true;
    }
    //通过前17位数字及权重，获得第18位校验码
    let checkCode = this.getCheckCodeBy17(idCard);
    //比较正确的校验码与输入的第18位字符，且当非老身份证号码时
    if (checkCodeMap[checkCode.toString()].indexOf(idCard.substr(17, 1)) < 0 && !isOldCard) {
      console.log('false，身份证号码验证失败');
      return false;
    }
    console.log('true，身份证号码验证通过');
    return true;
  };

  /**
   * 查询出指定级别的区域对象
   * @param areaCode 区域代码
   * @param isSelectOld 是否查询老数据，默认不查询
   * @returns 行政区域对象
   */
  public getAreaByCode(areaCode: string, isSelectOld?: boolean) {
    let areaJsonFile = 'json/area.json',
      result = null,
      areaLevel = this.getAreaLevel(areaCode),       //获得传入区域代码的级别
      areaLevelOne: BasicArea = null,
      areaLevelTwo: BasicArea = null,
      arealevelThree: BasicArea = null,
      // getAreaURL = areaJsonFile + '?v=' + (new Date().getTime()); // 清除缓存
      getAreaURL = areaJsonFile; // 清除缓存
    isSelectOld = isNull(isSelectOld) ? true : isSelectOld;

    //取到省级区域对象
    if (areaLevel >= 1) {
      let shengCode = this.getAreaCodeOfSheng(areaCode);     //先取到省级区域代码
      if (!isNull(this.areaJson)) {
        for (let i in this.areaJson) {
          let condition = isSelectOld ? this.areaJson[i].areaCode == shengCode : (this.areaJson[i].areaCode == shengCode && this.areaJson[i].isNew == 1);
          if (condition) {
            areaLevelOne = this.areaJson[i];
            // console.info("级别：" + $rootScope.areaJson[i].level + "," + $rootScope.areaJson[i].fullName);
          }
        }
      }
      // 去除老数据
      if (!isSelectOld && !isNull(areaLevelOne)) {
        let newAreaArys: Array<BasicArea> = new Array;
        for (let i in areaLevelOne.children) {
          if (areaLevelOne.children[i].isNew == 1) {
            newAreaArys.push(areaLevelOne.children[i]);
          }
        }
        areaLevelOne.children = newAreaArys;
      }
    }
    //取到市级区域对象
    if (areaLevel >= 2) {
      let shiCode = this.getAreaCodeOfShi(areaCode);     //先取到市级区域代码
      if (!isNull(areaLevelOne) && !isNull(areaLevelOne.children)) {
        for (let i in areaLevelOne.children) {
          let condition = isSelectOld ? areaLevelOne.children[i].areaCode == shiCode : areaLevelOne.children[i].areaCode == shiCode && areaLevelOne.children[i].isNew == 1;
          if (condition) {
            areaLevelTwo = areaLevelOne.children[i];
            // console.info("级别：" + areaLevelOne.children[i].level + "," + areaLevelOne.children[i].fullName);
          }
        }
      }
      // 去除老数据
      if (!isSelectOld && !isNull(areaLevelTwo)) {
        let newAreaArys: Array<BasicArea> = new Array;
        for (let i in areaLevelTwo.children) {
          if (areaLevelTwo.children[i].isNew == 1) {
            newAreaArys.push(areaLevelTwo.children[i]);
          }
        }
        areaLevelTwo.children = newAreaArys;
      }
    }

    //取到县区级区域对象
    if (areaLevel == 3) {
      if (!isNull(areaLevelTwo) && !isNull(areaLevelTwo.children)) {
        for (let i in areaLevelTwo.children) {
          let condition = isSelectOld ? areaLevelTwo.children[i].areaCode == areaCode : areaLevelTwo.children[i].areaCode == areaCode && areaLevelTwo.children[i].isNew == 1;
          if (condition) {
            arealevelThree = areaLevelTwo.children[i];
            // console.info("级别：" + areaLevelTwo.children[i].level + "," + areaLevelTwo.children[i].fullName);
          }
        }
      }
      // 去除老数据
      if (!isSelectOld && !isNull(arealevelThree)) {
        let newAreaArys: Array<BasicArea> = new Array;
        for (let i in arealevelThree.children) {
          if (arealevelThree.children[i].isNew == 1) {
            newAreaArys.push(arealevelThree.children[i]);
          }
        }
        arealevelThree.children = newAreaArys;
      }
    }
    switch (areaLevel) {
      case 1 :
        result = areaLevelOne;
        break;
      case 2 :
        result = areaLevelTwo;
        break;
      case 3 :
        result = arealevelThree;
        break;
      default :
        result = this.areaJson;
    }
    return result;
  };

  /**
   * 通过前17位数字及权重，获得第18位校验码
   * @param idCard
   * @returns {number}
   */
  private getCheckCodeBy17(idCard) {
    let idCardNumAry: Array<string> = new Array();   //把身份证号转化为字符串数组
    for (let i = 0; i < idCard.length; i++) {
      idCardNumAry.push(idCard[i]);
    }

    const factorArr = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]; //权重值，身份证的每一位，与对应次序的数字进行相乘

    let countSum = 0;   //前17位数字与权重值乘积的和
    let checkCode = 0;
    //只记入前17位数字与权重值乘积的和
    for (let i = 0; i < 17; i++) {
      countSum += parseInt(idCardNumAry[i]) * factorArr[i];
    }
    //前17位数字与对应权重值的乘积和 除以 11 的余数,即最后一位校验码
    checkCode = countSum % 11;
    return checkCode;
  }

  /**
   * 15位身份证号转17位身份证号
   * @param card15
   * @returns {string}
   */
  private card15To17 = function (card15: string) {
    return card15.substring(0, 6) + '19' + card15.substring(6);
  };

  /**
   * 通过行政区域代码 6位字符，获得省级代码
   * @param areaCode
   * @returns {string} 6位全区域代码，不足补0
   */
  private getAreaCodeOfSheng = function (areaCode) {
    return areaCode.substr(0, 2) + '0000';
  };

  /**
   * 通过行政区域代码 6位字符，获得市级代码
   * @param areaCode
   * @returns {string} 6位全区域代码，不足补0
   */
  private getAreaCodeOfShi = function (areaCode) {
    return areaCode.substr(0, 4) + '00';
  };

  /**
   * 通过行政区域代码 6位字符，获得区域级别
   * @param areaCode
   * @returns {number}
   */
  private getAreaLevel = function (areaCode) {
    let level = 0;
    if (isNull(areaCode)) {
      return level;
    }
    areaCode = areaCode.toString();
    if (areaCode.length != 6) return level;

    if (areaCode.substr(2, 4) == '0000') level = 1;
    else if (areaCode.substr(4, 2) == '00') level = 2;
    else level = 3;
    return level;
  }

  /**
   * 格式化日期
   * @param date 日期对象
   * @param fmt  格式化形式
   * @returns {any}
   */
  dataFormat = function (date: Date, fmt) {
    var o = {
      "M+": date.getMonth() + 1, //月份
      "d+": date.getDate(), //日
      "H+": date.getHours(), //小时
      "m+": date.getMinutes(), //分
      "s+": date.getSeconds(), //秒
      "q+": Math.floor((date.getMonth() + 3) / 3), //季度
      "S": date.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
      if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
  }

  /**
   * 根据指定日期，获取其前后日期
   * @param date 指定日期
   * @param num  时间 （1代表后一天，2代表后两天，-1代表前一天......等等）
   */
  getAroundDateByDate = function (date: Date, num: number) {
    return new Date(date.getTime() + (1000 * 60 * 60 * 24) * num);
  }

  /**
   * 根据日期获取是星期几
   * @param date 日期
   * @returns {string}
   */
  getWeek = function (date: Date) {
    let weeks: Array<any> = this.getEnumDataList(1008), week: string, num: number = date.getDay() + 1;
    for (let i = 0; i < weeks.length; i++) {
      if (num.toString() == weeks[i]["val"]) week = weeks[i]["key"];
    }
    return week;
  }

  /**
   * 获取日期时间戳
   * @param string 日期：2017-08-14 或 2017-08-14 15:30:00
   * @returns {number}
   * @constructor
   */
  dateToUnix = function (string) {
    var f = string.split(' ', 2);
    var d = (f[0] ? f[0] : '').split('-', 3);
    var t = (f[1] ? f[1] : '').split(':', 3);
    return (new Date(
      parseInt(d[0], 10) || null,
      (parseInt(d[1], 10) || 1) - 1,
      parseInt(d[2], 10) || null,
      parseInt(t[0], 10) || null,
      parseInt(t[1], 10) || null,
      parseInt(t[2], 10) || null
    )).getTime();
  }

  /**
   * 根据类型标示获取枚举信息
   * @param code 类型标示（如：1001、1002、1003....）
   * @returns {any}
   */
  public getEnumData = function (code) {
    let _this = this;
    if (!_this.enumData.hasOwnProperty(code)) {
      this.ajax.get({
        async: false,
        url: '/res/enum/' + code,
        success: function (result) {
          if (isNullOrUndefined(result)) return ""; else _this.enumData[code] = result;
        }
      });
    }
    return _this.enumData[code];
  }

  /**
   * 根据类型标示获取枚举list信息
   * code 类型标示（如：1001、1002、1003....）
   * @param code
   * @returns {Array<any>}
   */
  public getEnumDataList = function (code) {
    let list: Array<any> = new Array<any>();
    let enumInfo = this.getEnumData(code);
    for (var prop in enumInfo) {
      if (enumInfo.hasOwnProperty(prop)) list.push({"key": prop, "val": enumInfo[prop]})
    }
    return list;
  }

  /**
   * 根据类型标示和key获取信息值
   * @param code （如：1001、1002、1003....）
   * @param key （如：ILLNESSCASE、TYPELESS、NURSING....）
   * @returns {any}
   */
  public getEnumDataValByKey = function (code, key) {
    var enumData = this.getEnumData(code);
    if (enumData != null && enumData != "" && enumData != undefined) {
      if (enumData[key] != null && enumData[key] != "" && enumData[key] != undefined) return enumData[key];
      else return "";
    } else {
      return "";
    }
  };

  /**
   * 获取时区信息
   * @returns {Array<any>}
   */
  public getTimeZones = function () {
    let _this = this;
    if (_this.timezones.length < 1) {
      _this.ajax.get({
        url: '/res/tz/timezones',
        async: false,
        success: (res) => {
          if (res.success) _this.timezones = res.data;
        }
      });
    }
    return _this.timezones;
  }

  /**
   * 获取国家代码信息
   * @returns {Array<any>}
   */
  public getCountryCode() {
    let _this = this;
    if (_this.countryCode.length < 1) {
      _this.ajax.get({
        url: '/res/area/countries',
        async: false,
        success: (res) => {
          if (res.success) _this.countryCode = res.data;
        }
      });
    }
    return _this.countryCode;
  }

  /**
   * 弹框提醒
   * @param type 类型：error、success、wait、info、warning
   * @param title 标题
   * @param info 信息
   */
  rzhAlt = function (type: string, title: string, info?: string) {
    if (isNullOrUndefined(info)) this.toaster.pop(type, title);
    else this.toaster.pop(type, title, info);
  }

  /**
   * 获取单节课程约课人数上限
   */
  getUpperClassLimit = function () {
    let _this = this;
    if (isNullOrUndefined(_this.upperClassLimit)) {
      _this.ajax.get({
        url: '/setting/loadset',
        data: {k: "Upper_Class_Limit"},
        async: false,
        success: (res) => {
          if (res.success) _this.upperClassLimit = res.data;
        }
      });
    }
    return _this.upperClassLimit;
  }

  /**
   * 获取上传文件的uid
   * @returns {any}
   */
  uploadUid = function () {
    let _this = this, uid;
    _this.ajax.get({
      url: '/upload/basic/uid',
      async: false,
      success: (res) => {
        if (res.success) uid = res.data;
      }
    });
    return uid;
  }

  /**
   * 格式化数据为树形结构数据
   * @param array 需要格式化的数组
   * @param code 根据key值判断父子级别（code为key名称）
   * @param parent 制定父级（若指定父级，将获取此级别下的tree信息）
   * @returns {Array<any>}
   */
  arrayToTree(array: Array<any>, code: string, parent: string = '', level?: number) {
    const me = this;
    if (!level) level = 1;
    const list: Array<any> = new Array();
    array.forEach((el, i) => {
      el.level = level;
      if (el.superCode === parent) {
        const children = me.arrayToTree(array, code, el[code], level+1);
        el.children = children;
        list.push(el);
      }
    });
    return list;
  }

  /**
   * 查看大图
   * @param img
   */
  bigImg(img) {
    swal({
      title: '',
      text: "<img style='min-width: 300px;max-width: 800px;' src='" + img + "'/>",
      animation: 'slide-from-top',
      html: true
    });
    $(".showSweetAlert").css("width", "auto");
  }

  /**
   * 获取国际化信息
   */
  getI18nInfos(countryCode?: string) {
    let _this = this, browserLang = countryCode || _this.translate.getBrowserLang();
    if (isNullOrUndefined(browserLang) || browserLang == "") browserLang = "en";
    $.get({
      url: "../../../assets/i18n/" + browserLang + ".json",
      async: false,
      success: (response) => {
        SettingsService.I18NINFO = response.ts;
      }
    })
  }

  /**
   * 把一个数组中的对象从另一个数组中去除，通过一致的key值。
   * @param attackArr              去除的数组（小）；
   * @param sufferArr              被去除的数组（大）
   * @param key                   key
   * @returns {any}               返回去除后的新数组
   */
  arrayWeightingOfObject(attackArr: Array<any>, sufferArr: Array<any>, key?: string) {
    if (attackArr[0]) {
      let arr = sufferArr.filter(ele => {
        return key ? (ele[key] != attackArr[0][key]) : (ele != attackArr[0]);
      });
      attackArr.shift();
      return key ? this.arrayWeightingOfObject(attackArr, arr, key) : this.arrayWeightingOfObject(attackArr, arr);
    } else {
      return sufferArr;
    }
  }


  /************************************************时区时间转换 begin************************************************/
  /**
   * 当前时区时间转UTC时间
   * @param date 指定时区的时间，格式YYYY-MM-DD HH:mm:ss 或者 YYYY-MM-DD 等...
   * @param format 返回的格式化数据，默认 YYYY-MM-DD HH:mm:ss
   */
  dateToUTC(date?: string, format?: string) {
    if (isNullOrUndefined(format) || format == "") format = "YYYY-MM-DD HH:mm:ss";
    if (isNullOrUndefined(date) || date == "") date = this.dataFormat(new Date(), "yyyy-MM-dd HH:mm:ss");
    let setdate = moment(date);
    return setdate.tz("UTC").format(format);
  }

  /**
   * 将UTC时间转化为本地时间
   * @param date UTC时间值,格式YYYY-MM-DD HH:mm:ss 或者 YYYY-MM-DD 等...
   * @param format 返回的格式化数据，默认 yyyy-MM-dd HH:mm:ss
   * @constructor
   */
  UTCToDate(date: string, format?: string) {
    if (isNullOrUndefined(format) || format == "") format = "yyyy-MM-dd HH:mm:ss";
    let _this = this, setdate = moment.tz(date, "UTC"), time = new Date(setdate);
    return _this.dataFormat(time, format);
  }

  /**
   * 把指定时区的时间转为UTC时间
   * @param date 指定时区的时间，格式YYYY-MM-DD HH:mm:ss 或者 YYYY-MM-DD 等...
   * @param timeZone 指定的时区，如：Asia/Shanghai，Asia/Tokyo 等...
   * @param format 返回的格式化数据，默认 YYYY-MM-DD HH:mm:ss
   */
  timeZoneDateToUTC(date: string, timeZone: string, format?: string) {
    if (isNullOrUndefined(format) || format == "") format = "YYYY-MM-DD HH:mm:ss";
    let time = moment.tz(date, timeZone);
    return time.tz("UTC").format(format)
  }

  /**
   * 把UTC时间转为指定时区的时间
   * @param date UTC的时间，格式YYYY-MM-DD HH:mm:ss 或者 YYYY-MM-DD 等...
   * @param timeZone 指定的时区，如：Asia/Shanghai，Asia/Tokyo 等...
   * @param format 返回的格式化数据，默认 YYYY-MM-DD HH:mm:ss
   */
  UTCToTimeZoneDate(date: string, timeZone: string, format?: string) {
    if (isNullOrUndefined(format) || format == "") format = "YYYY-MM-DD HH:mm:ss";
    let time = moment.tz(date, "UTC");
    return time.tz(timeZone).format(format)
  }


  /**
   * 指定时区时间转换为指定时区的时间
   * @param date 指定时区的时间，格式YYYY-MM-DD HH:mm:ss 或者 YYYY-MM-DD 等...
   * @param timeZone 被转换的时区标志，如：Asia/Shanghai，Asia/Tokyo 等...
   * @param otherTimeZone 目标时区标志，如：Asia/Shanghai，Asia/Tokyo 等...
   * @param format 返回的格式化数据，默认 YYYY-MM-DD HH:mm:ss
   * @returns {string}
   */
  timeZoneDateToTimeZoneDate(date: string, timeZone: string, otherTimeZone: string, format?: string) {
    if (isNullOrUndefined(format) || format == "") format = "YYYY-MM-DD HH:mm:ss";
    let time = moment.tz(date, timeZone);
    return time.tz(otherTimeZone).format(format)
  }

  // console.log("本地时间转UTC---", _this.tools.dateToUTC()); //本地转UTC
  // console.log("指定的UTC转本地---", _this.tools.UTCToDate("2017-09-21 10:00:00")); //UTC时间转本地时间
  // console.log("指定时区的时间转UTC时间---", _this.tools.timeZoneDateToUTC("2017-09-21 18:00:00", "Asia/Tokyo")); //指定时区的时间转UTC时间
  // console.log("UTC时间转指定时区的时间---", _this.tools.UTCToTimeZoneDate("2017-09-21 10:00:00", "Asia/Tokyo")); //UTC时间转指定时区的时间
  // console.log("指定时区的时间转指定时区的时间---", _this.tools.timeZoneDateToTimeZoneDate("2017-09-21 10:00:00", "Asia/Shanghai","Asia/Tokyo")); //UTC时间转指定时区的时间
  /************************************************时区时间转换 end**************************************************/

}

@Injectable()
export class BasicArea {
  areaCode: string;    // 区域编号
  areaName: string;    // 区域名字
  fullName: string;    // 全名称
  isNew: number;       // 是否新区域编号
  level: number;       // 区域级别
  sheng: string;       // 省级编号，不足后补 0000
  shi: string;         // 市级编号，不足后补 00
  children: Array<BasicArea>;  //当前区域下子集
}
