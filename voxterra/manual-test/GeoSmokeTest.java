import fr.voxterra.geo.*;
import fr.voxterra.climate.*;

public class GeoSmokeTest {
  public static void main(String[] args) {
    GeoEngine.init(123456789L);
    double min=9999,max=-9999; int land=0, river=0, n=0;
    long t0=System.nanoTime();
    for(int z=-8000; z<=8000; z+=128){
      for(int x=-8000; x<=8000; x+=128){
        GeoSample g=GeoEngine.sample(x,z); n++;
        min=Math.min(min,g.terrainHeight()); max=Math.max(max,g.terrainHeight());
        if(g.terrainHeight()>=GeoEngine.SEA_LEVEL) land++;
        if(g.river().river() && g.river().mask()>0.5) river++;
      }
    }
    long dt=System.nanoTime()-t0;
    ClimateSnapshot c=ClimateEngine.sample(72L*24000L, 1000, 80, 10000);
    System.out.printf("samples=%d land=%.1f%% river=%.2f%% y=[%.1f,%.1f] climate=%.1fC time=%.3fs%n", n,land*100.0/n,river*100.0/n,min,max,c.temperatureC(),dt/1e9);
  }
}
