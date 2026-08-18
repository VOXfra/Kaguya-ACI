package fr.vox.chronomarkplus;

/** Native Espruino apps installed alongside Bethesda files. ASCII-only on purpose. */
final class NativeWatchApps {
    private NativeWatchApps() {}

    static final String MUSIC_INFO = "{\"id\":\"musicplus\",\"name\":\"Music Control+\",\"src\":\"musicplus.app.js\",\"icon\":\"music.img\",\"sortorder\":-8,\"version\":\"1.00\",\"files\":\"musicplus.info,musicplus.app.js\"}";
    static final String PHONE_INFO = "{\"id\":\"phone\",\"name\":\"Phone Status\",\"src\":\"phone.app.js\",\"icon\":\"message.img\",\"sortorder\":-8,\"version\":\"1.00\",\"files\":\"phone.info,phone.app.js\"}";

    static final String MUSIC_APP = """
(function(){
  var M=(typeof state==='object'&&state.music)?state.music:{playing:false,player:'',artist:'',track:'',time:0,dur:10000,rate:1,upd:getTime(),vol:0};
  var timer=0, exiting=false, a='#00AAFF';
  global.__voxActiveApp='NATIVE_MUSIC';
  function fit(s,w){s=s||'';g.setFontGrotesk16();if(g.stringWidth(s)<=w)return s;while(s.length>1&&g.stringWidth(s+'...')>w)s=s.substr(0,s.length-1);return s+'...';}
  function pos(){var p=M.time||0;if(M.playing&&M.upd)p+=(getTime()-M.upd)*(M.rate||1);return Math.max(0,Math.min(M.dur||1,p));}
  function tm(v){v=Math.max(0,v|0);return Math.floor(v/60)+':'+(v%60).toString().padStart(2,'0');}
  function draw(){
    if(exiting||global.__voxActiveApp!=='NATIVE_MUSIC')return;
    a=global.__voxNativeAccent||'#00AAFF';
    g.reset().clear(1);
    if(global.__voxNativeArt)g.drawImage(global.__voxNativeArt,0,0,{scale:2});else g.setColor('#181820').fillRect(0,0,239,239);
    Dickens.loadSurround();if(g.drawTicks)g.drawTicks();if(g.drawBT)g.drawBT();if(g.drawBat)g.drawBat();
    var p=pos(),d=Math.max(1,M.dur||1),a1=3.912,a2=4.712,am=a2-(a2-a1)*Math.max(0,Math.min(1,p/d));
    g.setColor('#333').drawSlice(a1,am,72,95);g.setColor(a).drawSlice(am,a2,73,94);
    var v1=1.571,v2=2.371,vm=v2-(v2-v1)*Math.max(0,Math.min(1,M.vol||0));g.setColor('#333').drawSlice(v1,vm,72,95);g.setColor(a).drawSlice(vm,v2,73,94);if(global.icons&&icons.volume)g.drawImage(icons.volume,198,104);
    g.setFontGrotesk16().setFontAlign(0,-1).setColor(a).drawString(fit(M.artist||M.player||'Music',104),120,83);
    var dte=Date(),hh=dte.getHours().toString().padStart(2,'0'),mm=dte.getMinutes().toString().padStart(2,'0');g.setFontArchitekt35().setFontAlign(0,0).setColor('#FFF').drawString(hh+':'+mm,119,115);
    g.setFontGrotesk16().setFontAlign(0,-1).setColor('#DDE6EA').drawString(fit(M.track||'',104),120,139);
    g.setFontArchitekt10().setFontAlign(0,-1).setColor('#DDD').drawString(tm(p),37,107);
    g.setColor(a);var seed=(p|0)%7;for(var i=0;i<3;i++){var h=M.playing?(4+((seed+i*3)%14)):2;g.fillRect(108+i*8,210-h,114+i*8,210);}
    Dickens.buttonIcons=[M.playing?'pause':'play','clock','down','up'];Dickens.loadSurround();g.flip();
  }
  function upd(x){if(exiting)return;if(x&&(x.id==='title'||x.id==='artist'||x.id==='name'))print('VOX_V08:NATIVE_TRACK');draw();}
  function cmd(c){try{NRF.amsCommand(c);}catch(e){}}
  function b3(){var fired=false,t=setTimeout(function(){fired=true;global.__voxNMV3=setInterval(function(){if(BTN3.read())cmd('voldown');else{clearInterval(global.__voxNMV3);global.__voxNMV3=0;}},250);},450);setWatch(function(){clearTimeout(t);if(!fired)cmd('next');},BTN3,{edge:-1});}
  function b4(){var fired=false,t=setTimeout(function(){fired=true;global.__voxNMV4=setInterval(function(){if(BTN4.read())cmd('volup');else{clearInterval(global.__voxNMV4);global.__voxNMV4=0;}},250);},450);setWatch(function(){clearTimeout(t);if(!fired)cmd('prev');},BTN4,{edge:-1});}
  function exit(){if(exiting)return;exiting=true;try{if(timer)clearInterval(timer);if(global.__voxNMV3)clearInterval(global.__voxNMV3);if(global.__voxNMV4)clearInterval(global.__voxNMV4);E.removeListener('AMSupdate',upd);E.clearWatches();}catch(e){}global.__voxActiveApp='';print('VOX_V08:NATIVE_MUSIC_CLOSE');load('clock.app.js');}
  global.__voxNativeMusicSetArt=function(img,col){if(global.__voxActiveApp!=='NATIVE_MUSIC')return;global.__voxNativeArt=img;global.__voxNativeAccent=col||'#00AAFF';draw();};
  global.__voxNativeMusicClearArt=function(){if(global.__voxActiveApp!=='NATIVE_MUSIC')return;global.__voxNativeArt=undefined;draw();};
  E.on('AMSupdate',upd);setWatch(function(){cmd('playpause');},BTN1,{edge:1,repeat:1});setWatch(exit,BTN2,{edge:1,repeat:1});setWatch(b3,BTN3,{edge:1,repeat:1});setWatch(b4,BTN4,{edge:1,repeat:1});
  timer=setInterval(draw,1000);draw();print('VOX_V08:NATIVE_MUSIC_OPEN');
})();
""";

    static final String PHONE_APP = """
(function(){
  var P=global.__voxNativePhone||{page:0,batt:0,charge:'...',net:'...',ring:'...',find:false};
  global.__voxNativePhone=P;global.__voxActiveApp='NATIVE_PHONE';
  function base(){if(global.__voxActiveApp!=='NATIVE_PHONE')return false;g.reset().setClipRect(0,0,239,239).clear(1);Dickens.buttonIcons=[null,'clock','down','up'];Dickens.loadSurround();g.setColor('#181820').fillCircleAA(119,119,92);g.setClipRect(40,34,198,190);return true;}
  function status(){if(!base())return;g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('TELEPHONE',119,43);g.setColor(P.batt<=20?'#E04B3F':'#E49E4C').setFontArchitekt35().drawString(P.batt+'%',119,78);var bw=112,bx=63;g.setColor('#3A4144').fillRect(bx,103,bx+bw,111);g.setColor(P.batt<=20?'#E04B3F':'#78C6BE').fillRect(bx,103,bx+bw*P.batt/100,111);g.setFontArchitekt10().setColor('#FFF').drawString(P.charge,119,126);g.setColor('#8FA1A7').drawString('RESEAU',78,145).drawString('SON',160,145);g.setColor('#FFF').drawString(P.net,78,159).drawString(P.ring,160,159);g.setColor('#00BCEB').drawString('BTN1  FIND PHONE',119,181);g.setClipRect(0,0,239,239);g.flip();}
  function find(){if(!base())return;g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('FIND PHONE',119,45);g.setColor(P.find?'#E49E4C':'#78C6BE').drawRect(102,70,136,126).drawRect(105,74,133,118).fillCircle(119,122,2);g.setFontGrotesk14().setColor(P.find?'#E49E4C':'#FFF').drawString(P.find?'TELEPHONE SONNE':'PRET A SONNER',119,145);g.setFontArchitekt10().setColor('#00BCEB').drawString(P.find?'BTN1  ARRETER':'BTN1  SONNER',119,165);g.setColor('#9BA4A7').drawString('BTN3 / BTN4  STATUS',119,184);g.setClipRect(0,0,239,239);g.flip();}
  function draw(){if(P.page===0)status();else find();}
  function page(d){P.page=(P.page+d+2)%2;draw();}
  function exit(){try{E.clearWatches();}catch(e){}global.__voxActiveApp='';print('VOX_V08:NATIVE_PHONE_CLOSE');load('clock.app.js');}
  global.__voxNativePhoneUpdate=function(b,c,n,r,f){P.batt=b;P.charge=c;P.net=n;P.ring=r;P.find=!!f;draw();};
  setWatch(function(){if(P.page===0){P.page=1;draw();}else print('VOX_V08:NATIVE_FIND');},BTN1,{edge:1,repeat:1});setWatch(exit,BTN2,{edge:1,repeat:1});setWatch(function(){page(1);},BTN3,{edge:1,repeat:1});setWatch(function(){page(-1);},BTN4,{edge:1,repeat:1});
  draw();print('VOX_V08:NATIVE_PHONE_OPEN');
})();
""";
}
