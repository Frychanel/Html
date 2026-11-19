using UnityEngine;

namespace BahiaDorada
{
    // Nivel de búsqueda (0-5 estrellas) y patrullas que persiguen al jugador.
    public static class Police
    {
        public static int Level;
        static float lastCrime = -999, cool, spawnT, bustT;

        public static void AddWanted(int n) { Level = Mathf.Min(5, Level + n); lastCrime = Time.time; cool = 0; HUD.FlashStars(); }
        public static bool CopNear(float r)
        {
            if (!Player.I) return false;
            foreach (var c in Car.All) if (c.isPolice && c.driver == Car.Driver.Police && Vector3.Distance(c.transform.position, Player.I.Pos) < r) return true;
            return false;
        }

        public static void Update()
        {
            var pl = Player.I; if (!pl) return;
            float nearest = 1e9f; int active = 0;
            for (int k = Car.All.Count - 1; k >= 0; k--)
            {
                var c = Car.All[k]; if (c.driver != Car.Driver.Police) continue;
                float d = Vector3.Distance(c.transform.position, pl.Pos);
                if (Level == 0 && d > 110) { Object.Destroy(c.gameObject); continue; }
                nearest = Mathf.Min(nearest, d); active++;
            }
            if (Level > 0)
            {
                if (Time.time - lastCrime > 10 && nearest > 70) { cool += Time.deltaTime; if (cool > 9) { Level--; cool = 0; } } else cool = 0;
                int want = Mathf.Min(6, 1 + Mathf.FloorToInt(Level * 1.3f));
                spawnT -= Time.deltaTime;
                if (active < want && spawnT <= 0) { Spawn(pl.Pos); spawnT = 2.5f; }
                bool slow = pl.car ? Mathf.Abs(pl.car.speed) < 2.5f : true;
                bool close = false;
                foreach (var c in Car.All) if (c.driver == Car.Driver.Police && Vector3.Distance(c.transform.position, pl.Pos) < 7f && Mathf.Abs(c.speed) < 4f) close = true;
                bustT = close && slow ? bustT + Time.deltaTime : 0;
                if (bustT > 2.6f) { bustT = 0; GameBootstrap.I.KnockOut(true); }
            }
        }

        static void Spawn(Vector3 around)
        {
            for (int t = 0; t < 30; t++)
            {
                var n = City.Node(Random.Range(0, City.N + 1), Random.Range(0, City.N + 1));
                float d = Vector3.Distance(n, around);
                if (d < 90 || d > 200) continue;
                var car = Car.Spawn(n + new Vector3(3, 0, 3), Quaternion.LookRotation(around - n).eulerAngles.y, true);
                car.SeatDriver(Human.Create(car.transform, null, new Color(0.1f, 0.2f, 0.55f), new Color(0.05f, 0.08f, 0.2f), new Color(0.05f, 0.08f, 0.2f)));
                car.driver = Car.Driver.Police; car.gameObject.AddComponent<PoliceAI>();
                return;
            }
        }
    }

    public class PoliceAI : MonoBehaviour
    {
        Car car; float stuck, rev;
        void Start() { car = GetComponent<Car>(); }
        void Update()
        {
            if (!car || car.driver != Car.Driver.Police || !Player.I) return;
            Vector3 target = Player.I.Pos, p = transform.position;
            float d = Vector3.Distance(target, p);
            if (Police.Level == 0) { car.throttle = 0.6f; car.steer = 0; return; }
            if (d > 45f)
            {   // sigue la calle más cercana en dirección al jugador
                int i = Mathf.Clamp(Mathf.RoundToInt((p.x + City.HALF) / City.CELL), 0, City.N), j = Mathf.Clamp(Mathf.RoundToInt((p.z + City.HALF) / City.CELL), 0, City.N);
                Vector3 best = City.Node(i, j); float bd = 1e9f;
                foreach (var (di, dj) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
                {
                    int a = i + di, b = j + dj; if (a < 0 || b < 0 || a > City.N || b > City.N) continue;
                    var n = City.Node(a, b); float nd = Vector3.Distance(n, target);
                    if (nd < bd) { bd = nd; best = n; }
                }
                if (Vector3.Distance(City.Node(i, j), p) > 9f) best = City.Node(i, j);
                target = best;
            }
            Vector3 to = target - p; to.y = 0;
            float diff = Vector3.SignedAngle(transform.forward, to, Vector3.up);
            float thr = Mathf.Abs(diff) > 80 ? 0.35f : 1f, str = Mathf.Clamp(diff / 25f, -1, 1); bool hb = false;
            if (d < 12) { thr = d < 7 ? -0.6f : 0.2f; if (car.speed < 0) thr = 0; hb = d < 7; }
            if (rev > 0) { rev -= Time.deltaTime; thr = -1; str = -str; }
            else if (Mathf.Abs(car.speed) < 1.5f && d > 14) { stuck += Time.deltaTime; if (stuck > 1.6f) { rev = 1.1f; stuck = 0; } }
            else stuck = 0;
            car.throttle = thr; car.steer = str; car.handbrake = hb;
        }
    }
}
