using UnityEngine;

namespace BahiaDorada
{
    // Conductor del tráfico: sigue los carriles de la cuadrícula y gira al azar en los cruces.
    public class TrafficAI : MonoBehaviour
    {
        static readonly int[,] Dirs = { { 1, 0 }, { 0, 1 }, { -1, 0 }, { 0, -1 } };
        public int ni, nj, d; float cruise; Car car; float wait;

        public static Vector3 Lane(int i, int j, int d) { var n = City.Node(i, j); return n + new Vector3(Dirs[d, 1] * 4f, 0, -Dirs[d, 0] * 4f); }

        public void Init(int i, int j, int dir) { ni = i; nj = j; d = dir; cruise = Random.Range(10f, 15f); car = GetComponent<Car>(); car.driver = Car.Driver.Traffic; }

        void Update()
        {
            if (!car || car.driver != Car.Driver.Traffic) return;
            Vector3 tg = Lane(ni, nj, d), p = transform.position; tg.y = p.y;
            if (Vector3.Distance(tg, p) < 6f) NextNode();
            tg = Lane(ni, nj, d); tg.y = p.y;
            Vector3 to = tg - p;
            float diff = Vector3.SignedAngle(transform.forward, to, Vector3.up);
            float target = Mathf.Abs(diff) > 20f ? 6f : cruise;
            if (Physics.Raycast(p + Vector3.up * 0.8f + transform.forward * 2.5f, transform.forward, out var hit, 10f))
            {
                if (hit.collider.GetComponentInParent<Car>() || hit.collider.GetComponent<Player>()) { target = 0; wait += Time.deltaTime; }
            }
            else wait = 0;
            if (wait > 6f) { target = cruise; if (wait > 8f) wait = 0; }
            car.steer = Mathf.Clamp(diff / 30f, -1f, 1f);
            car.throttle = car.speed < target - 0.5f ? 1f : car.speed > target + 1.5f ? -0.6f : 0f;
            car.handbrake = target == 0 && car.speed < 1f;
        }

        void NextNode()
        {
            int[] opts = { d, d, (d + 1) % 4, (d + 3) % 4 };
            for (int k = 0; k < 8; k++)
            {
                int nd = opts[Random.Range(0, opts.Length)], i2 = ni + Dirs[nd, 0], j2 = nj + Dirs[nd, 1];
                if (i2 >= 0 && j2 >= 0 && i2 <= City.N && j2 <= City.N) { d = nd; ni = i2; nj = j2; return; }
            }
            d = (d + 2) % 4; ni += Dirs[d, 0]; nj += Dirs[d, 1];
        }

        // Mantiene unos cuantos coches circulando cerca del jugador.
        public static void Manage(Vector3 around, int want)
        {
            int count = 0;
            for (int k = Car.All.Count - 1; k >= 0; k--)
            {
                var c = Car.All[k];
                if (c.driver != Car.Driver.Traffic) continue;
                if (Vector3.Distance(c.transform.position, around) > 300f) { Destroy(c.gameObject); continue; }
                count++;
            }
            if (count >= want) return;
            for (int tries = 0; tries < 10; tries++)
            {
                int i = Random.Range(0, City.N + 1), j = Random.Range(0, City.N + 1), dir = Random.Range(0, 4);
                int i2 = i + Dirs[dir, 0], j2 = j + Dirs[dir, 1];
                if (i2 < 0 || j2 < 0 || i2 > City.N || j2 > City.N) continue;
                Vector3 a = Lane(i, j, dir), b = Lane(i2, j2, dir), pos = Vector3.Lerp(a, b, Random.Range(0.2f, 0.6f));
                float dd = Vector3.Distance(pos, around);
                if (dd < 80f || dd > 250f) continue;
                bool blocked = false; foreach (var other in Car.All) if (Vector3.Distance(other.transform.position, pos) < 10f) blocked = true;
                if (blocked) continue;
                var car = Car.Spawn(pos, Quaternion.LookRotation(b - a).eulerAngles.y);
                car.SeatDriver(Human.Create(car.transform));
                car.gameObject.AddComponent<TrafficAI>().Init(i2, j2, dir);
                return;
            }
        }
    }
}
