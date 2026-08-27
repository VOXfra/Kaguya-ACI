import fr.voxterra.geo.*;
public class GeoWideTest {
 public static void main(String[] a){
  long[] seeds={1,42,123456789L,987654321L};
  for(long s:seeds){GeoEngine.init(s);int n=0,land=0;double min=9999,max=-9999;long t=System.nanoTime();
   for(int z=-100000;z<=100000;z+=2000)for(int x=-100000;x<=100000;x+=2000){double h=GeoEngine.baseHeight(x,z);n++;if(h>=63)land++;min=Math.min(min,h);max=Math.max(max,h);} 
   System.out.printf("seed=%d land=%.1f y=%.0f..%.0f t=%.2fs%n",s,land*100.0/n,min,max,(System.nanoTime()-t)/1e9);
  }
 }
}
