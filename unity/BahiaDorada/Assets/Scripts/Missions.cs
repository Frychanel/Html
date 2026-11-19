using System.Collections.Generic;
using UnityEngine;

namespace BahiaDorada
{
    // Misiones: marcadores amarillos en la ciudad. Al entrar en uno empieza un trabajo.
    public class Missions : MonoBehaviour
    {
        class Step { public Vector3 at; public bool needCar; public float time; public string text; public bool wanted; }
        readonly List<GameObject> givers = new List<GameObject>();
        List<Step> steps; int idx; float timer = -1; string title; int reward; GameObject beam;
        static readonly string[] Titles = { "EL PAQUETE", "VUELTA RÁPIDA", "CALOR POLICIAL" };

        void Start()
        {
            foreach (var p in City.MissionSpots) givers.Add(Marker(p, new Color(1f, 0.85f, 0.2f, 0.45f), 1.4f, 1.6f));
            beam = Marker(Vector3.zero, new Color(1f, 0.2f, 0.2f, 0.35f), 0.5f, 80f); beam.SetActive(false);
        }

        static GameObject Marker(Vector3 p, Color c, float r, float h)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Destroy(g.GetComponent<Collider>());
            g.transform.position = p + Vector3.up * h / 2; g.transform.localScale = new Vector3(r * 2, h / 2, r * 2);
            var m = Mats.Emissive(c, c * 1.5f);
            g.GetComponent<Renderer>().sharedMaterial = m; return g;
        }

        Vector3 RandomNode(Vector3 from, float min, float max)
        {
            for (int k = 0; k < 200; k++) { var n = City.Node(Random.Range(0, City.N + 1), Random.Range(0, City.N + 1)); float d = Vector3.Distance(n, from); if (d >= min && d <= max) return n; }
            return City.Node(6, 6);
        }

        void StartMission(int id)
        {
            var pl = Player.I.Pos; title = Titles[id]; idx = -1; steps = new List<Step>();
            if (id == 0)
            {
                reward = 600; var a = RandomNode(pl, 180, 380); var b = RandomNode(a, 380, 700);
                HUD.Sub("<color=#f4d64e>Tía Lupe:</color> Rafita, recoge una caja de tamales y llévala a la fiesta de tu primo. ¡Calientitos!", 5);
                steps.Add(new Step { at = a, needCar = true, text = "Recoge la <color=#f4d64e>caja de tamales</color>." });
                steps.Add(new Step { at = b, needCar = true, time = 100, text = "Lleva los tamales a la <color=#f4d64e>fiesta</color>." });
            }
            else if (id == 1)
            {
                reward = 1000; Vector3 cur = pl;
                HUD.Sub("<color=#f4d64e>Chispa:</color> Dicen que manejas como abuela. Demuéstralo: pasa por todos los puntos.", 5);
                for (int k = 0; k < 8; k++) { cur = RandomNode(cur, 150, 260); steps.Add(new Step { at = cur, needCar = true, time = k == 0 ? 130 : 0, text = "Punto de control <color=#f4d64e>" + (k + 1) + "/8</color>" }); }
            }
            else
            {
                reward = 1500;
                HUD.Sub("<color=#f4d64e>El Profe:</color> Recoge un maletín en la playa. Y ojo, la zona está vigilada.", 5);
                steps.Add(new Step { at = new Vector3(-650, 0, 120), text = "Recoge el <color=#f4d64e>maletín</color> en Playa Coral." });
                steps.Add(new Step { wanted = true, text = "<color=#ff6b6b>¡Era una trampa!</color> Escapa de la policía." });
                steps.Add(new Step { at = City.HomeSpawn, text = "Vuelve a <color=#f4d64e>casa</color>." });
            }
            HUD.Big(title, new Color(0.96f, 0.84f, 0.3f));
            foreach (var g in givers) g.SetActive(false);
            Next();
        }

        void Next()
        {
            idx++;
            if (idx >= steps.Count) { Pass(); return; }
            var s = steps[idx];
            if (s.time > 0) timer = s.time;
            if (s.wanted) Police.AddWanted(3);
            HUD.Sub(s.text, 6);
            beam.SetActive(!s.wanted); if (!s.wanted) beam.transform.position = s.at + Vector3.up * 40;
        }

        void Pass() { Player.I.AddMoney(reward); HUD.Big("¡MISIÓN SUPERADA!\n+$" + reward, new Color(0.96f, 0.84f, 0.3f)); End(); }
        public void Fail(string why) { if (steps == null) return; HUD.Big("MISIÓN FALLIDA", new Color(1f, 0.36f, 0.36f)); HUD.Sub(why, 4); End(); }
        void End() { steps = null; timer = -1; beam.SetActive(false); foreach (var g in givers) g.SetActive(true); HUD.Timer(-1); }

        void Update()
        {
            if (!Player.I) return;
            var pl = Player.I.Pos;
            if (steps == null)
            {
                for (int i = 0; i < givers.Count; i++)
                    if (!Player.I.car && Vector3.Distance(new Vector3(pl.x, 0, pl.z), new Vector3(givers[i].transform.position.x, 0, givers[i].transform.position.z)) < 1.8f) { StartMission(i); break; }
                return;
            }
            if (timer >= 0) { timer -= Time.deltaTime; HUD.Timer(timer); if (timer <= 0) { Fail("Se acabó el tiempo."); return; } }
            var s = steps[idx];
            if (s.wanted) { if (Police.Level == 0) Next(); return; }
            float r = Player.I.car ? 8f : 3.5f;
            if (Vector3.Distance(new Vector3(pl.x, 0, pl.z), new Vector3(s.at.x, 0, s.at.z)) < r)
            {
                if (s.needCar && !Player.I.car) HUD.Prompt("Necesitas un vehículo.");
                else Next();
            }
        }

        public Vector3? Objective => steps != null && idx < steps.Count && !steps[idx].wanted ? steps[idx].at : (Vector3?)null;
    }
}
