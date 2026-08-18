package fr.vox.chronomarkplus;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.util.Base64;

import java.util.Locale;

final class NativeArtCodec {
    static final int SIZE = 120;

    static final class Result {
        final int[] palette565;
        final String base64;
        final String accentHex;
        Result(int[] p, String b, String a) { palette565=p; base64=b; accentHex=a; }
    }

    private NativeArtCodec() {}

    static Result encode(Bitmap input) {
        if (input == null) return null;
        int side = Math.min(input.getWidth(), input.getHeight());
        int sx = (input.getWidth()-side)/2, sy = (input.getHeight()-side)/2;
        Bitmap square = Bitmap.createBitmap(input,sx,sy,side,side);
        Bitmap b = Bitmap.createScaledBitmap(square,SIZE,SIZE,true);
        if (square != input) square.recycle();

        int[] raw = new int[SIZE*SIZE];
        b.getPixels(raw,0,SIZE,0,0,SIZE,SIZE);
        String accent = dominantAccent(raw);
        int[] px = new int[raw.length];
        for (int i=0;i<raw.length;i++) {
            int r=(int)(Color.red(raw[i])*0.43f);
            int g=(int)(Color.green(raw[i])*0.43f);
            int bl=(int)(Color.blue(raw[i])*0.43f);
            px[i]=Color.rgb(r,g,bl);
        }

        final int k=16;
        int[][] c=new int[k][3];
        for(int i=0;i<k;i++) {
            int col=px[Math.min(px.length-1,(i*px.length)/k)];
            c[i][0]=Color.red(col);c[i][1]=Color.green(col);c[i][2]=Color.blue(col);
        }
        int[] idx=new int[px.length];
        for(int it=0;it<6;it++) {
            long[][] sum=new long[k][3]; int[] count=new int[k];
            for(int i=0;i<px.length;i++) {
                int r=Color.red(px[i]),g=Color.green(px[i]),bl=Color.blue(px[i]);
                int best=0; long bestD=Long.MAX_VALUE;
                for(int j=0;j<k;j++) {
                    long dr=r-c[j][0],dg=g-c[j][1],db=bl-c[j][2],d=dr*dr+dg*dg+db*db;
                    if(d<bestD){bestD=d;best=j;}
                }
                idx[i]=best;count[best]++;sum[best][0]+=r;sum[best][1]+=g;sum[best][2]+=bl;
            }
            for(int j=0;j<k;j++) if(count[j]>0) {
                c[j][0]=(int)(sum[j][0]/count[j]);c[j][1]=(int)(sum[j][1]/count[j]);c[j][2]=(int)(sum[j][2]/count[j]);
            }
        }
        for(int i=0;i<px.length;i++) {
            int r=Color.red(px[i]),g=Color.green(px[i]),bl=Color.blue(px[i]);int best=0;long bestD=Long.MAX_VALUE;
            for(int j=0;j<k;j++){long dr=r-c[j][0],dg=g-c[j][1],db=bl-c[j][2],d=dr*dr+dg*dg+db*db;if(d<bestD){bestD=d;best=j;}}
            idx[i]=best;
        }
        byte[] packed=new byte[(px.length+1)/2];
        for(int i=0;i<px.length;i+=2){int a=idx[i]&15,z=(i+1<px.length)?idx[i+1]&15:0;packed[i/2]=(byte)((a<<4)|z);}
        int[] pal=new int[k];
        for(int j=0;j<k;j++){int r=c[j][0],g=c[j][1],bl=c[j][2];pal[j]=((r>>3)<<11)|((g>>2)<<5)|(bl>>3);}
        b.recycle();
        return new Result(pal, Base64.encodeToString(packed,Base64.NO_WRAP), accent);
    }

    static String jsArray(int[] a) {
        StringBuilder s=new StringBuilder("[");
        for(int i=0;i<a.length;i++){if(i>0)s.append(',');s.append(a[i]);}
        return s.append(']').toString();
    }

    private static String dominantAccent(int[] px) {
        final int bins=24;
        double[] score=new double[bins],rr=new double[bins],gg=new double[bins],bb=new double[bins],ww=new double[bins];
        float[] hsv=new float[3];
        for(int col:px) {
            int r=Color.red(col),g=Color.green(col),b=Color.blue(col);Color.RGBToHSV(r,g,b,hsv);
            float sat=hsv[1],val=hsv[2];
            if(sat<0.22f||val<0.16f||val>0.97f)continue;
            int bin=Math.min(bins-1,(int)(hsv[0]/360f*bins));
            double w=(0.25+sat*sat)*(0.35+val);score[bin]+=w;rr[bin]+=r*w;gg[bin]+=g*w;bb[bin]+=b*w;ww[bin]+=w;
        }
        int best=-1;double bs=0;for(int i=0;i<bins;i++)if(score[i]>bs){bs=score[i];best=i;}
        if(best<0||ww[best]<1)return "#00AAFF";
        int r=(int)(rr[best]/ww[best]),g=(int)(gg[best]/ww[best]),b=(int)(bb[best]/ww[best]);Color.RGBToHSV(r,g,b,hsv);
        hsv[1]=Math.max(0.55f,hsv[1]);hsv[2]=Math.min(0.92f,Math.max(0.62f,hsv[2]));int vivid=Color.HSVToColor(hsv);
        return String.format(Locale.ROOT,"#%02X%02X%02X",Color.red(vivid),Color.green(vivid),Color.blue(vivid));
    }
}
