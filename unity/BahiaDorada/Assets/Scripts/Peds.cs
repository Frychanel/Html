using System.Collections.Generic;
using UnityEngine;

namespace BahiaDorada
{
    // Peatones: pasean por las aceras, hablan con el jugador, huyen, se defienden y caen si los atropellan.
    public class Peds : MonoBehaviour
    {
        public class Ped
        {
            public Human h; public string name; public Vector3 center; public float t, dir, speed; public string state = "walk";
            public float timer, hp = 100; public bool tough; public Vector3 pos; public float yaw;
        }
        public static readonly List<Ped> List = new List<Ped>();
        public static bool Talking => talk != null;
        static Ped talk;
        static readonly string[] NamesF = { "Marta", "Carmen", "Lucía", "Rosa", "Elena", "Sofía", "Inés", "Nora" };
        static readonly string[] NamesM = { "Luis", "Diego", "Jorge", "Pablo", "Raúl", "Hugo", "Tomás", "Bruno" };
        static readonly string[] Greet = { "¡Hola! ¿Qué tal?", "¡Ey, qué onda!", "Buenas, buenas.", "¡Saludos, vecino!", "¿Te conozco de algo?" };
        static readonly string[] Chat = { "Dicen que en el muelle pasan cosas raras de noche.", "El tráfico en el Centro está imposible.", "Ten cuidado, la policía anda nerviosa.", "En la playa se ve el mejor atardecer de la costa." };
        static readonly string[] Hurt = { "¡Ay!", "¡Socorro!", "¡Estás loco!", "¡Bruto!" };
        static readonly string[] Tough = { "¿Buscas pelea? La encontraste.", "Te vas a arrepentir.", "¡Ven acá!" };

        public static void Create(int count)
        {
            var root = new GameObject("Peatones").AddComponent<Peds>();
            for (int k = 0; k < count; k++)
            {
                var p = new Ped { h = Human.Create(root.transform), tough = Random.value < 0.2f };
                p.name = Random.value < 0.5f ? NamesF[Random.Range(0, NamesF.Length)] : NamesM[Random.Range(0, NamesM.Length)];
                Place(p, Player.I ? Player.I.Pos : Vector3.zero, true);
                List.Add(p);
            }
        }

        static void Place(Ped p, Vector3 around, bool near)
        {
            int bi = City.CellIdx(around.x), bj = City.CellIdx(around.z);
            for (int tries = 0; tries < 20; tries++)
            {
                int i = Mathf.Clamp(bi + Random.Range(-3, 4), 0, City.N - 1), j = Mathf.Clamp(bj + Random.Range(-3, 4), 0, City.N - 1);
                var c = City.BlockCenter(i, j); float t = Random.Range(0, City.SIDE * 8);
                var pos = City.PerimeterPoint(c, t);
                if (!near && Vector3.Distance(pos, around) < 60) continue;
                p.center = c; p.t = t; p.pos = pos; p.dir = Random.value < 0.5f ? 1 : -1; p.speed = Random.Range(1.1f, 1.7f); p.state = "walk"; p.hp = 100;
                p.h.transform.localRotation = Quaternion.identity; return;
            }
        }

        void Update()
        {
            if (!Player.I) return;
            float dt = Time.deltaTime; Vector3 pl = Player.I.Pos;
            foreach (var p in List)
            {
                float dist = Vector3.Distance(p.pos, pl), spd = 0;
                switch (p.state)
                {
                    case "walk":
                        p.t += p.dir * p.speed * dt; var np = City.PerimeterPoint(p.center, p.t);
                        if ((np - p.pos).sqrMagnitude > 1e-6f) p.yaw = Quaternion.LookRotation(np - p.pos).eulerAngles.y;
                        p.pos = np; spd = p.speed; break;
                    case "talk":
                        p.yaw = Quaternion.LookRotation(Flat(pl - p.pos)).eulerAngles.y; if (dist > 4.5f) EndTalk(); break;
                    case "flee":
                        p.timer -= dt; var away = Flat(p.pos - pl).normalized; p.pos += away * 4.5f * dt; p.yaw = Quaternion.LookRotation(away).eulerAngles.y; spd = 4.5f;
                        if (p.timer <= 0) p.state = "return"; break;
                    case "fight":
                        if (Player.I.car || dist > 30) { p.state = "return"; break; }
                        p.timer -= dt; var to = Flat(pl - p.pos);
                        if (dist > 1.2f) { p.pos += to.normalized * 3.8f * dt; spd = 3.8f; }
                        else if (p.timer <= 0) { p.timer = 1.1f; p.h.punchT = 0.35f; Player.I.Hurt(7, p.pos); }
                        p.yaw = Quaternion.LookRotation(to).eulerAngles.y; break;
                    case "down":
                        p.timer -= dt; if (p.timer <= 0) { p.state = "flee"; p.timer = 4; p.hp = 60; p.h.transform.localRotation = Quaternion.identity; }
                        break;
                    case "return":
                        var back = City.PerimeterPoint(p.center, p.t); var dv = Flat(back - p.pos);
                        if (dv.magnitude < 0.3f) p.state = "walk"; else { p.pos += dv.normalized * 1.8f * dt; p.yaw = Quaternion.LookRotation(dv).eulerAngles.y; spd = 1.8f; }
                        break;
                }
                bool vis = dist < 140f; if (p.h.gameObject.activeSelf != vis) p.h.gameObject.SetActive(vis);
                if (!vis) { if (dist > 240f && p.state != "talk") Place(p, pl, false); continue; }
                p.pos.y = 0.3f;
                p.h.transform.position = p.pos;
                if (p.state != "down") { p.h.transform.rotation = Quaternion.Euler(0, p.yaw, 0); p.h.Animate(spd, dt); }
            }
        }

        static Vector3 Flat(Vector3 v) { v.y = 0; return v.sqrMagnitude < 1e-5f ? Vector3.forward : v; }

        public static Ped Nearest(Vector3 at, float r)
        {
            Ped best = null; float bd = r;
            foreach (var p in List) { if (p.state == "down") continue; float d = Vector3.Distance(Flat2(p.pos), Flat2(at)); if (d < bd) { bd = d; best = p; } }
            return best;
        }
        static Vector3 Flat2(Vector3 v) { v.y = 0; return v; }

        public static void TryTalk(Player pl)
        {
            if (talk != null) { NextLine(); return; }
            var p = Nearest(pl.transform.position, 3f); if (p == null) return;
            talk = p; p.state = "talk"; p.h.waveT = 1.4f; talkStep = 0;
            HUD.Sub("<color=#f4d64e>Rafa:</color> ¡Hola!", 2);
            HUD.Bubble(p.name + ": " + Greet[Random.Range(0, Greet.Length)]);
            HUD.Prompt("E / 💬 — seguir hablando");
        }
        static int talkStep;
        static void NextLine()
        {
            talkStep++;
            if (talkStep == 1) { HUD.Sub("<color=#f4d64e>Rafa:</color> ¿Qué se cuenta por aquí?", 2.5f); HUD.Bubble(talk.name + ": " + Chat[Random.Range(0, Chat.Length)]); }
            else EndTalk();
        }
        static void EndTalk() { if (talk != null && talk.state == "talk") talk.state = "walk"; talk = null; HUD.Bubble(""); }

        public static void Hit(Ped p, Vector3 dir)
        {
            if (talk == p) EndTalk();
            p.hp -= Random.Range(30f, 50f); p.h.punchT = 0;
            if (p.hp <= 0) KnockDown(p, dir);
            else if (p.tough) { p.state = "fight"; p.timer = 0.6f; HUD.Bubble(p.name + ": " + Tough[Random.Range(0, Tough.Length)]); }
            else { p.state = "flee"; p.timer = 5; HUD.Bubble(p.name + ": " + Hurt[Random.Range(0, Hurt.Length)]); }
        }

        static void KnockDown(Ped p, Vector3 dir)
        {
            p.state = "down"; p.timer = 7; p.pos += Flat(dir).normalized * 1.5f;
            p.h.transform.rotation = Quaternion.LookRotation(Flat(dir)) * Quaternion.Euler(-90, 0, 0);
            p.h.transform.position = p.pos + Vector3.up * 0.2f;
            if (Random.value < 0.6f || Police.CopNear(90)) Police.AddWanted(1);
            foreach (var o in List) if (o != p && o.state == "walk" && Vector3.Distance(o.pos, p.pos) < 25) { o.state = "flee"; o.timer = 5; }
        }

        public static void CheckCarHits(Car car)
        {
            if (Mathf.Abs(car.speed) < 4f) return;
            foreach (var p in List)
                if (p.state != "down" && Vector3.Distance(Flat2(p.pos), Flat2(car.transform.position)) < 2.4f) { KnockDown(p, car.transform.forward); car.speed *= 0.85f; }
        }

        public static void Eject(Car c)
        {
            var h = c.driverBody; c.driverBody = null;
            h.transform.SetParent(FindObjectOfTypeSafe().transform, true); h.transform.localScale = Vector3.one;
            var p = new Ped { h = h, name = "Conductor", center = City.BlockCenter(Mathf.Clamp(City.CellIdx(c.transform.position.x), 0, City.N - 1), Mathf.Clamp(City.CellIdx(c.transform.position.z), 0, City.N - 1)) };
            p.pos = c.transform.position - c.transform.right * 2.4f; p.state = "flee"; p.timer = 5; p.speed = 1.4f; p.dir = 1;
            List.Add(p); HUD.Bubble("Conductor: ¡Mi coche! ¡Ladrón!");
        }
        static Peds inst;
        static Peds FindObjectOfTypeSafe()
        {
            if (inst) return inst;
#if UNITY_2022_2_OR_NEWER
            inst = FindFirstObjectByType<Peds>();
#else
            inst = FindObjectOfType<Peds>();
#endif
            return inst;
        }
    }
}
