using UnityEngine;
using UnityEngine.UI;

namespace BahiaDorada
{
    // Interfaz: reloj, dinero, salud, estrellas, radar, subtítulos y mensajes. Se construye por código.
    public class HUD : MonoBehaviour
    {
        static HUD I;
        Text clock, money, stars, sub, big, prompt, zone, speedo, timer, bubble;
        Image health; RawImage radar; Camera radarCam; RectTransform playerArrow;
        float subT, bigT, zoneT, flashT; string lastZone = "";
        public static Font Font;

        public static Canvas Create()
        {
            var go = new GameObject("HUD");
            var canvas = go.AddComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 10;
            var sc = go.AddComponent<CanvasScaler>(); sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; sc.referenceResolution = new Vector2(1920, 1080); sc.matchWidthOrHeight = 1f;
            go.AddComponent<GraphicRaycaster>();
            try { Font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { }
            if (!Font) try { Font = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { }
            var h = go.AddComponent<HUD>(); I = h;
            h.clock = Label(go.transform, "09:00", 64, new Vector2(1, 1), new Vector2(-40, -30), TextAnchor.UpperRight, Color.white);
            var hb = Panel(go.transform, new Vector2(1, 1), new Vector2(-40, -110), new Vector2(260, 22), new Color(0.3f, 0.05f, 0.05f));
            h.health = Panel(hb.transform, new Vector2(0, 0.5f), Vector2.zero, new Vector2(260, 22), new Color(0.9f, 0.2f, 0.2f)).GetComponent<Image>();
            h.health.rectTransform.pivot = new Vector2(0, 0.5f); h.health.rectTransform.anchoredPosition = Vector2.zero;
            h.money = Label(go.transform, "$00000250", 60, new Vector2(1, 1), new Vector2(-40, -140), TextAnchor.UpperRight, new Color(0.25f, 0.75f, 0.35f));
            h.stars = Label(go.transform, "", 52, new Vector2(1, 1), new Vector2(-40, -215), TextAnchor.UpperRight, new Color(0.96f, 0.84f, 0.3f));
            h.timer = Label(go.transform, "", 56, new Vector2(1, 1), new Vector2(-40, -285), TextAnchor.UpperRight, Color.white);
            h.zone = Label(go.transform, "", 54, new Vector2(0.5f, 1), new Vector2(0, -120), TextAnchor.UpperCenter, new Color(0.9f, 0.9f, 0.9f));
            h.big = Label(go.transform, "", 80, new Vector2(0.5f, 0.68f), Vector2.zero, TextAnchor.MiddleCenter, new Color(0.96f, 0.84f, 0.3f));
            h.sub = Label(go.transform, "", 40, new Vector2(0.5f, 0), new Vector2(0, 70), TextAnchor.LowerCenter, Color.white); h.sub.rectTransform.sizeDelta = new Vector2(1000, 200);
            h.prompt = Label(go.transform, "", 34, new Vector2(0.5f, 0), new Vector2(0, 300), TextAnchor.LowerCenter, new Color(1f, 0.95f, 0.75f));
            h.bubble = Label(go.transform, "", 38, new Vector2(0.5f, 0.6f), Vector2.zero, TextAnchor.MiddleCenter, Color.white);
            h.speedo = Label(go.transform, "", 52, new Vector2(0, 0), new Vector2(60, 360), TextAnchor.LowerLeft, Color.white);
            // Radar: cámara cenital renderizada en una textura
            var rt = new RenderTexture(256, 256, 16);
            var rc = new GameObject("RadarCam").AddComponent<Camera>(); rc.orthographic = true; rc.orthographicSize = 90; rc.targetTexture = rt;
            rc.clearFlags = CameraClearFlags.SolidColor; rc.backgroundColor = new Color(0.18f, 0.4f, 0.6f); rc.farClipPlane = 400; h.radarCam = rc;
            var frame = Panel(go.transform, new Vector2(0, 1), new Vector2(40, -40), new Vector2(330, 330), new Color(0, 0, 0, 0.85f));
            frame.GetComponent<RectTransform>().pivot = new Vector2(0, 1);
            var ri = new GameObject("Radar").AddComponent<RawImage>(); ri.transform.SetParent(frame.transform, false); ri.texture = rt;
            ri.rectTransform.sizeDelta = new Vector2(310, 310); h.radar = ri;
            var arrow = Panel(ri.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(18, 26), Color.white); h.playerArrow = arrow.GetComponent<RectTransform>();
            return canvas;
        }

        public static Text Label(Transform p, string s, int size, Vector2 anchor, Vector2 pos, TextAnchor align, Color c)
        {
            var go = new GameObject("Texto"); go.transform.SetParent(p, false);
            var t = go.AddComponent<Text>(); t.font = Font; t.fontSize = size; t.alignment = align; t.color = c; t.text = s; t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow; t.fontStyle = FontStyle.Bold;
            var o = go.AddComponent<Outline>(); o.effectColor = Color.black; o.effectDistance = new Vector2(3, -3);
            var rt = t.rectTransform; rt.anchorMin = rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(1200, 120);
            return t;
        }
        public static GameObject Panel(Transform p, Vector2 anchor, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject("Panel"); go.transform.SetParent(p, false);
            var im = go.AddComponent<Image>(); im.color = c;
            var rt = im.rectTransform; rt.anchorMin = rt.anchorMax = anchor; rt.pivot = new Vector2(0.5f, 0.5f); rt.anchoredPosition = pos; rt.sizeDelta = size;
            return go;
        }

        public static void Sub(string s, float t) { if (!I) return; I.sub.text = s; I.subT = t; }
        public static void Big(string s, Color c) { if (!I) return; I.big.text = s; I.big.color = c; I.bigT = 4; }
        public static void Prompt(string s) { if (I && I.prompt.text != s) I.prompt.text = s; }
        public static void Bubble(string s) { if (I) I.bubble.text = s; }
        public static void Timer(float t) { if (I) I.timer.text = t < 0 ? "" : Mathf.FloorToInt(t / 60) + ":" + Mathf.FloorToInt(t % 60).ToString("00"); }
        public static void Vehicle(string n) { if (I) { I.zone.text = n; I.zoneT = 2.5f; } }
        public static void InCar(bool b) { MobileControls.SetCarMode(b); }
        public static void FlashStars() { if (I) I.flashT = 2f; }

        void Update()
        {
            var pl = Player.I; if (!pl) return;
            int m = Mathf.FloorToInt(DayNight.Minutes);
            clock.text = (m / 60).ToString("00") + ":" + (m % 60).ToString("00");
            money.text = "$" + Mathf.RoundToInt(pl.money).ToString("00000000");
            health.rectTransform.sizeDelta = new Vector2(260 * Mathf.Clamp01(pl.health / 100f), 22);
            string st = ""; for (int i = 0; i < 5; i++) st += i < Police.Level ? "★" : "☆";
            flashT -= Time.deltaTime; stars.text = Police.Level == 0 ? "" : (flashT > 0 && Mathf.FloorToInt(Time.time * 6) % 2 == 0 ? "" : st);
            speedo.text = pl.car ? Mathf.RoundToInt(Mathf.Abs(pl.car.speed) * 3.6f) + " KM/H" : "";
            if ((subT -= Time.deltaTime) <= 0) sub.text = "";
            if ((bigT -= Time.deltaTime) <= 0) big.text = "";
            string z = City.ZoneName(pl.Pos); if (z != lastZone) { lastZone = z; zone.text = z; zoneT = 3; }
            if ((zoneT -= Time.deltaTime) <= 0) zone.text = "";
            float yaw = CameraRig.I ? CameraRig.I.yaw : 0;
            radarCam.transform.position = pl.Pos + Vector3.up * 200; radarCam.transform.rotation = Quaternion.Euler(90, yaw, 0);
            playerArrow.localRotation = Quaternion.Euler(0, 0, yaw - pl.Yaw);
        }
    }
}
