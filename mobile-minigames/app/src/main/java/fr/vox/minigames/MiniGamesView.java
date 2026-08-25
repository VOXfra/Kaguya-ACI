package fr.vox.minigames;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.SystemClock;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** UI Canvas autonome et légère pour le hub et Liquid Sort. */
public final class MiniGamesView extends View {
    private static final int SCREEN_HUB = 0;
    private static final int SCREEN_SORT = 1;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final SharedPreferences prefs;
    private final float d;
    private final int[] palette = {0xFF46C9FF,0xFFFFD54A,0xFFFF657A,0xFF72E58B,0xFFAF7BFF,0xFFFF9848,0xFF47E2D1,0xFFFF78D1,0xFF9EE85D,0xFF6D8DFF};
    private int screen = SCREEN_HUB, currentLevel, unlockedLevel, selectedBottle = -1;
    private int hintFrom = -1, hintTo = -1;
    private long hintUntil, winSince;
    private WaterSortGame game;
    private PourFx pourFx;
    private final RectF playCard = new RectF(), hubPlayButton = new RectF(), homeButton = new RectF();
    private final RectF undoButton = new RectF(), restartButton = new RectF(), hintButton = new RectF(), nextButton = new RectF();
    private final List<RectF> bottleRects = new ArrayList<>();

    private static final class PourFx {
        final float x1,y1,x2,y2; final int color; final long start;
        PourFx(float x1,float y1,float x2,float y2,int color){this.x1=x1;this.y1=y1;this.x2=x2;this.y2=y2;this.color=color;start=SystemClock.uptimeMillis();}
    }

    public MiniGamesView(Context context) {
        super(context);
        d = getResources().getDisplayMetrics().density;
        prefs = context.getSharedPreferences("vox_minigames", Context.MODE_PRIVATE);
        unlockedLevel = Math.max(0, Math.min(LevelCatalog.count()-1, prefs.getInt("unlocked",0)));
        currentLevel = Math.max(0, Math.min(unlockedLevel, prefs.getInt("current",0)));
        setLayerType(View.LAYER_TYPE_SOFTWARE,null);
    }

    @Override protected void onDraw(Canvas c){super.onDraw(c);drawBackground(c);if(screen==SCREEN_HUB)drawHub(c);else drawSort(c);}
    private void drawBackground(Canvas c){c.drawColor(0xFF101827);paint.setStyle(Paint.Style.FILL);paint.setColor(0xFF17243A);c.drawCircle(getWidth()*.12f,getHeight()*.18f,dp(140),paint);paint.setColor(0xFF132F42);c.drawCircle(getWidth()*.92f,getHeight()*.72f,dp(190),paint);}

    private void drawHub(Canvas c){
        float w=getWidth(),margin=dp(22),top=dp(148);
        text(c,"VOX",dp(28),dp(54),dp(28),0xFF8DEBFF,Paint.Align.LEFT,true);
        text(c,"MINI GAMES",dp(28),dp(83),dp(24),Color.WHITE,Paint.Align.LEFT,true);
        text(c,"Des parties rapides. Une seule appli.",dp(28),dp(110),dp(14),0xFFAFC1D9,Paint.Align.LEFT,false);
        playCard.set(margin,top,w-margin,top+dp(254));panel(c,playCard,0xFF1C2D49,dp(22),true);
        RectF art=new RectF(playCard.left+dp(16),playCard.top+dp(16),playCard.right-dp(16),playCard.top+dp(142));paint.setColor(0xFF243A5B);c.drawRoundRect(art,dp(18),dp(18),paint);
        hubBottle(c,art.centerX()-dp(55),art.centerY()+dp(12),new int[]{0,1,0,2});hubBottle(c,art.centerX(),art.centerY()+dp(12),new int[]{2,0,1,1});hubBottle(c,art.centerX()+dp(55),art.centerY()+dp(12),new int[]{});
        text(c,"Liquid Sort",playCard.left+dp(20),playCard.top+dp(178),dp(21),Color.WHITE,Paint.Align.LEFT,true);
        text(c,"Trie chaque couleur dans sa bouteille",playCard.left+dp(20),playCard.top+dp(202),dp(13),0xFFB9CBE1,Paint.Align.LEFT,false);
        hubPlayButton.set(playCard.right-dp(112),playCard.bottom-dp(48),playCard.right-dp(18),playCard.bottom-dp(14));button(c,hubPlayButton,"JOUER",0xFF45D6FF,0xFF0A2330,true);
        text(c,String.format(Locale.FRANCE,"%d/%d",unlockedLevel+1,LevelCatalog.count()),playCard.left+dp(20),playCard.bottom-dp(25),dp(12),0xFF86A3C4,Paint.Align.LEFT,true);
        text(c,"À VENIR",margin,playCard.bottom+dp(44),dp(13),0xFF7F98B7,Paint.Align.LEFT,true);
        float gap=dp(10),cardW=(w-margin*2-gap*2)/3f;String[] names={"Parking","Slide","Connect"},icons={"P","↔","⌁"};
        for(int i=0;i<3;i++){RectF r=new RectF(margin+i*(cardW+gap),playCard.bottom+dp(58),margin+i*(cardW+gap)+cardW,playCard.bottom+dp(162));panel(c,r,0xFF18273E,dp(16),false);text(c,icons[i],r.centerX(),r.top+dp(42),dp(27),0xFF6683A5,Paint.Align.CENTER,true);text(c,names[i],r.centerX(),r.bottom-dp(16),dp(12),0xFF8AA2BF,Paint.Align.CENTER,true);}
        text(c,"Prototype Android v0.1",w/2f,getHeight()-dp(24),dp(11),0xFF607A98,Paint.Align.CENTER,false);
    }
    private void hubBottle(Canvas c,float cx,float bottom,int[] layers){float bw=dp(34),bh=dp(82);drawBottle(c,new RectF(cx-bw/2,bottom-bh,cx+bw/2,bottom),layers,false,false);}

    private void drawSort(Canvas c){
        if(game==null)loadLevel(currentLevel);long now=SystemClock.uptimeMillis();float w=getWidth();
        homeButton.set(dp(16),dp(20),dp(58),dp(62));iconButton(c,homeButton,"‹");text(c,"LIQUID SORT",w/2f,dp(42),dp(16),0xFF8DEBFF,Paint.Align.CENTER,true);text(c,"Niveau "+(currentLevel+1),w/2f,dp(66),dp(13),0xFFAFC1D9,Paint.Align.CENTER,false);text(c,game.moves()+" coups",w-dp(18),dp(43),dp(12),0xFF7E9BBE,Paint.Align.RIGHT,true);
        layoutBottles();
        for(int i=0;i<bottleRects.size();i++){RectF base=bottleRects.get(i),r=new RectF(base);boolean selected=i==selectedBottle;if(selected)r.offset(0,-dp(10));boolean hinted=now<hintUntil&&(i==hintFrom||i==hintTo);int[] layers=new int[game.size(i)];for(int j=0;j<layers.length;j++)layers[j]=game.get(i,j);drawBottle(c,r,layers,selected,hinted);if(game.isBottleComplete(i)){paint.setColor(0xFF6EE7A6);c.drawCircle(r.centerX(),r.bottom+dp(13),dp(3.5f),paint);}}
        if(now<hintUntil&&hintFrom>=0&&hintTo>=0)hintArrow(c,bottleRects.get(hintFrom),bottleRects.get(hintTo));drawPourFx(c,now);
        float btnY=getHeight()-dp(88),gap=dp(10),bw=(w-dp(32)-gap*2)/3f;undoButton.set(dp(16),btnY,dp(16)+bw,btnY+dp(52));restartButton.set(undoButton.right+gap,btnY,undoButton.right+gap+bw,btnY+dp(52));hintButton.set(restartButton.right+gap,btnY,restartButton.right+gap+bw,btnY+dp(52));button(c,undoButton,"↶  Annuler",game.canUndo()?0xFF203653:0xFF17263A,game.canUndo()?Color.WHITE:0xFF536A85,false);button(c,restartButton,"↻  Refaire",0xFF203653,Color.WHITE,false);button(c,hintButton,"✦  Indice",0xFF203653,Color.WHITE,false);
        if(game.isSolved()){if(winSince==0){winSince=now;unlockNext();performHapticFeedback(HapticFeedbackConstants.CONFIRM);}drawWin(c,now);}if((pourFx!=null&&now-pourFx.start<420)||now<hintUntil||winSince>0)postInvalidateOnAnimation();
    }

    private void layoutBottles(){
        bottleRects.clear();int count=game.bottleCount(),rows=count<=5?1:2,topCount=rows==1?count:(count+1)/2,bottomCount=rows==1?0:count-topCount;float areaTop=dp(104),areaBottom=getHeight()-dp(116),rowGap=dp(26),maxW=dp(58),gap=dp(11),usable=getWidth()-dp(30),bw=Math.min(maxW,(usable-(topCount-1)*gap)/topCount);bw=Math.max(dp(36),bw);float bh=bw*2.05f;
        if(rows==1){float y=(areaTop+areaBottom)/2f-bh/2f;addRow(topCount,y,bw,bh,gap);}else{float totalH=bh*2+rowGap,y1=(areaTop+areaBottom-totalH)/2f,y2=y1+bh+rowGap;addRow(topCount,y1,bw,bh,gap);addRow(bottomCount,y2,bw,bh,gap);}
    }
    private void addRow(int count,float y,float bw,float bh,float gap){if(count<=0)return;float total=count*bw+(count-1)*gap,x=(getWidth()-total)/2f;for(int i=0;i<count;i++)bottleRects.add(new RectF(x+i*(bw+gap),y,x+i*(bw+gap)+bw,y+bh));}

    private void drawBottle(Canvas c,RectF r,int[] layers,boolean selected,boolean hinted){
        float neck=r.width()*.48f,neckH=r.height()*.18f,bodyTop=r.top+neckH*.72f;RectF body=new RectF(r.left+dp(2),bodyTop,r.right-dp(2),r.bottom);Path clip=new Path();clip.addRoundRect(body,r.width()*.25f,r.width()*.25f,Path.Direction.CW);int save=c.save();c.clipPath(clip);float layerH=body.height()/WaterSortGame.CAPACITY;
        for(int i=0;i<layers.length;i++){float bottom=body.bottom-i*layerH,top=bottom-layerH-dp(.7f);paint.setColor(palette[layers[i]%palette.length]);paint.setStyle(Paint.Style.FILL);c.drawRect(body.left+dp(3),top,body.right-dp(3),bottom,paint);paint.setColor(0x33FFFFFF);c.drawRect(body.left+dp(5),top+dp(2),body.right-dp(5),top+dp(4),paint);}c.restoreToCount(save);
        stroke.setStyle(Paint.Style.STROKE);stroke.setStrokeWidth(dp(selected?3.2f:2.2f));stroke.setStrokeCap(Paint.Cap.ROUND);stroke.setColor(selected?0xFF8DEBFF:0xFFC9D8EA);c.drawRoundRect(body,r.width()*.25f,r.width()*.25f,stroke);c.drawLine(r.centerX()-neck/2,r.top,r.centerX()-neck/2,bodyTop+dp(2),stroke);c.drawLine(r.centerX()+neck/2,r.top,r.centerX()+neck/2,bodyTop+dp(2),stroke);c.drawLine(r.centerX()-neck/2,r.top,r.centerX()+neck/2,r.top,stroke);
        if(hinted){stroke.setStrokeWidth(dp(3));stroke.setColor(0xFFFFD54A);RectF ring=new RectF(r.left-dp(5),r.top-dp(5),r.right+dp(5),r.bottom+dp(5));c.drawRoundRect(ring,dp(18),dp(18),stroke);}
    }
    private void hintArrow(Canvas c,RectF from,RectF to){float sx=from.centerX(),sy=from.top-dp(14),ex=to.centerX(),ey=to.top-dp(14);stroke.setColor(0xFFFFD54A);stroke.setStrokeWidth(dp(3));stroke.setStyle(Paint.Style.STROKE);stroke.setStrokeCap(Paint.Cap.ROUND);c.drawLine(sx,sy,ex,ey,stroke);float dir=ex>=sx?1:-1;c.drawLine(ex,ey,ex-dir*dp(9),ey-dp(7),stroke);c.drawLine(ex,ey,ex-dir*dp(9),ey+dp(7),stroke);}
    private void drawPourFx(Canvas c,long now){if(pourFx==null)return;float t=(now-pourFx.start)/420f;if(t>=1f){pourFx=null;return;}float alpha=1f-Math.abs(t*2f-1f);stroke.setStyle(Paint.Style.STROKE);stroke.setStrokeCap(Paint.Cap.ROUND);stroke.setStrokeWidth(dp(5));int base=palette[pourFx.color%palette.length];stroke.setColor((Math.min(255,(int)(alpha*255))<<24)|(base&0x00FFFFFF));Path p=new Path();p.moveTo(pourFx.x1,pourFx.y1);float midY=Math.min(pourFx.y1,pourFx.y2)-dp(45);p.cubicTo(pourFx.x1,midY,pourFx.x2,midY,pourFx.x2,pourFx.y2);c.drawPath(p,stroke);}

    private void drawWin(Canvas c,long now){
        float t=Math.min(1f,(now-winSince)/300f);paint.setColor(((int)(170*t)<<24)|0x00101827);c.drawRect(0,0,getWidth(),getHeight(),paint);confetti(c,now);RectF panel=new RectF(dp(22),getHeight()/2f-dp(112),getWidth()-dp(22),getHeight()/2f+dp(112));panel(c,panel,0xFF1D304D,dp(24),true);text(c,"✓",panel.centerX(),panel.top+dp(57),dp(42),0xFF6EE7A6,Paint.Align.CENTER,true);text(c,"Niveau terminé !",panel.centerX(),panel.top+dp(98),dp(24),Color.WHITE,Paint.Align.CENTER,true);text(c,game.moves()+" coups",panel.centerX(),panel.top+dp(124),dp(13),0xFF9CB4CF,Paint.Align.CENTER,false);nextButton.set(panel.left+dp(28),panel.bottom-dp(58),panel.right-dp(28),panel.bottom-dp(16));button(c,nextButton,currentLevel+1<LevelCatalog.count()?"NIVEAU SUIVANT":"RETOUR AU HUB",0xFF45D6FF,0xFF0A2330,true);
    }
    private void confetti(Canvas c,long now){float phase=((now-winSince)%1800L)/1800f;for(int i=0;i<28;i++){float x=((i*73)%101)/100f*getWidth(),y=((i*41)%97)/97f*getHeight()+phase*dp(120);if(y>getHeight())y-=getHeight();paint.setColor(palette[i%palette.length]);c.save();c.rotate((phase*360+i*31)%360,x,y);c.drawRoundRect(new RectF(x-dp(2),y-dp(5),x+dp(2),y+dp(5)),dp(1),dp(1),paint);c.restore();}}
    private void panel(Canvas c,RectF r,int color,float radius,boolean shadowed){paint.setStyle(Paint.Style.FILL);if(shadowed)paint.setShadowLayer(dp(16),0,dp(8),0x55000000);paint.setColor(color);c.drawRoundRect(r,radius,radius,paint);paint.clearShadowLayer();}
    private void button(Canvas c,RectF r,String label,int bg,int fg,boolean bold){paint.setStyle(Paint.Style.FILL);paint.setColor(bg);c.drawRoundRect(r,dp(14),dp(14),paint);text(c,label,r.centerX(),r.centerY()+dp(5),dp(12),fg,Paint.Align.CENTER,bold);}
    private void iconButton(Canvas c,RectF r,String icon){paint.setColor(0xFF1D304B);c.drawRoundRect(r,dp(14),dp(14),paint);text(c,icon,r.centerX(),r.centerY()+dp(8),dp(30),Color.WHITE,Paint.Align.CENTER,false);}
    private void text(Canvas c,String s,float x,float y,float size,int color,Paint.Align align,boolean bold){paint.setStyle(Paint.Style.FILL);paint.setColor(color);paint.setTextSize(size);paint.setTextAlign(align);paint.setTypeface(bold?android.graphics.Typeface.DEFAULT_BOLD:android.graphics.Typeface.DEFAULT);c.drawText(s,x,y,paint);}

    @Override public boolean onTouchEvent(MotionEvent e){
        if(e.getAction()!=MotionEvent.ACTION_UP)return true;float x=e.getX(),y=e.getY();
        if(screen==SCREEN_HUB){if(playCard.contains(x,y)||hubPlayButton.contains(x,y)){currentLevel=Math.min(currentLevel,unlockedLevel);screen=SCREEN_SORT;loadLevel(currentLevel);performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);invalidate();}return true;}
        if(game!=null&&game.isSolved()){if(nextButton.contains(x,y)){if(currentLevel+1<LevelCatalog.count()){currentLevel++;loadLevel(currentLevel);}else{screen=SCREEN_HUB;game=null;}prefs.edit().putInt("current",currentLevel).apply();invalidate();}return true;}
        if(homeButton.contains(x,y)){screen=SCREEN_HUB;selectedBottle=-1;prefs.edit().putInt("current",currentLevel).apply();invalidate();return true;}
        if(undoButton.contains(x,y)){if(game.undo())performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);selectedBottle=-1;invalidate();return true;}
        if(restartButton.contains(x,y)){game.restart();selectedBottle=-1;winSince=0;performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);invalidate();return true;}
        if(hintButton.contains(x,y)){int[] hint=game.findHint();if(hint!=null){hintFrom=hint[0];hintTo=hint[1];hintUntil=SystemClock.uptimeMillis()+1600;performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);}invalidate();return true;}
        for(int i=0;i<bottleRects.size();i++){RectF hit=new RectF(bottleRects.get(i));hit.inset(-dp(7),-dp(9));if(hit.contains(x,y)){bottleTapped(i);return true;}}selectedBottle=-1;invalidate();return true;
    }
    private void bottleTapped(int index){
        if(selectedBottle<0){if(game.size(index)>0){selectedBottle=index;performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);}invalidate();return;}
        if(selectedBottle==index){selectedBottle=-1;invalidate();return;}int from=selectedBottle;WaterSortGame.MoveResult result=game.pour(from,index);if(result.moved){RectF src=bottleRects.get(from),dst=bottleRects.get(index);pourFx=new PourFx(src.centerX(),src.top+dp(12),dst.centerX(),dst.top+dp(12),result.color);performHapticFeedback(HapticFeedbackConstants.CONFIRM);selectedBottle=-1;}else if(game.size(index)>0){selectedBottle=index;performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);}else selectedBottle=-1;invalidate();
    }
    private void loadLevel(int level){currentLevel=Math.max(0,Math.min(level,LevelCatalog.count()-1));game=new WaterSortGame(LevelCatalog.get(currentLevel));selectedBottle=-1;hintFrom=hintTo=-1;hintUntil=0;winSince=0;pourFx=null;prefs.edit().putInt("current",currentLevel).apply();}
    private void unlockNext(){int candidate=Math.min(LevelCatalog.count()-1,currentLevel+1);if(candidate>unlockedLevel){unlockedLevel=candidate;prefs.edit().putInt("unlocked",unlockedLevel).apply();}}
    private float dp(float v){return v*d;}
}
