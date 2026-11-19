using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace BahiaDorada
{
    // Controles táctiles para móvil en horizontal: joystick a la izquierda y botones a la derecha.
    // En el coche: flechas de dirección a la izquierda y pedales a la derecha.
    public class MobileControls : MonoBehaviour
    {
        static GameObject foot, carSet;
        static Sprite circle;

        public static void Create(Canvas canvas, bool force)
        {
            bool touch = false; try { touch = Input.touchSupported; } catch (System.InvalidOperationException) { }
            if (!force && !Application.isMobilePlatform && !touch) return;
            circle = MakeCircle();
            var root = new GameObject("ControlesTactiles", typeof(RectTransform)); root.transform.SetParent(canvas.transform, false);
            Stretch(root.GetComponent<RectTransform>());
            root.AddComponent<MobileControls>();
            // Zona de cámara (arrastrar en la mitad derecha)
            var camZone = new GameObject("ZonaCamara", typeof(RectTransform)); camZone.transform.SetParent(root.transform, false);
            var czr = camZone.GetComponent<RectTransform>(); czr.anchorMin = new Vector2(0.45f, 0); czr.anchorMax = Vector2.one; czr.offsetMin = czr.offsetMax = Vector2.zero;
            camZone.AddComponent<Image>().color = new Color(0, 0, 0, 0); camZone.AddComponent<CameraDrag>();

            foot = new GameObject("APie", typeof(RectTransform)); foot.transform.SetParent(root.transform, false); Stretch(foot.GetComponent<RectTransform>());
            carSet = new GameObject("EnCoche", typeof(RectTransform)); carSet.transform.SetParent(root.transform, false); Stretch(carSet.GetComponent<RectTransform>());

            var js = Circle(foot.transform, new Vector2(0, 0), new Vector2(260, 260), new Vector2(330, 330), new Color(1, 1, 1, 0.15f));
            var knob = Circle(js.transform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(140, 140), new Color(1, 1, 1, 0.5f));
            js.gameObject.AddComponent<Joystick>().knob = knob.rectTransform;

            Button(foot.transform, "CORRER\n»", new Vector2(-170, 170), 240, new Color(0.96f, 0.84f, 0.3f, 0.55f), b => GameInput.TSprint = b);
            Button(foot.transform, "SALTAR", new Vector2(-150, 420), 150, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => GameInput.TJump = b);
            Button(foot.transform, "GOLPE", new Vector2(-350, 350), 150, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => { if (b) GameInput.PressPunch(); });
            Button(foot.transform, "SUBIR", new Vector2(-430, 150), 150, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => { if (b) GameInput.PressEnter(); });
            Button(foot.transform, "HABLAR", new Vector2(-330, 560), 130, new Color(0.25f, 0.55f, 0.9f, 0.6f), b => { if (b) GameInput.PressTalk(); });

            Button(carSet.transform, "◀", new Vector2(150, 170), 220, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => GameInput.TLeft = b, true);
            Button(carSet.transform, "▶", new Vector2(400, 170), 220, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => GameInput.TRight = b, true);
            Button(carSet.transform, "ACELERAR\n▲", new Vector2(-170, 170), 240, new Color(0.96f, 0.84f, 0.3f, 0.55f), b => GameInput.TGas = b);
            Button(carSet.transform, "FRENO\n▼", new Vector2(-430, 150), 160, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => GameInput.TBrake = b);
            Button(carSet.transform, "F. MANO", new Vector2(-350, 370), 150, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => GameInput.THandbrake = b);
            Button(carSet.transform, "CLAXON", new Vector2(-150, 440), 140, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => GameInput.THorn = b);
            Button(carSet.transform, "BAJAR", new Vector2(-150, 640), 140, new Color(0.15f, 0.15f, 0.17f, 0.6f), b => { if (b) GameInput.PressEnter(); });
            SetCarMode(false);
        }

        public static void SetCarMode(bool inCar) { if (foot) { foot.SetActive(!inCar); carSet.SetActive(inCar); } }

        static void Stretch(RectTransform r) { r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one; r.offsetMin = r.offsetMax = Vector2.zero; }

        static Image Circle(Transform p, Vector2 anchor, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject("Circulo", typeof(RectTransform)); go.transform.SetParent(p, false);
            var im = go.AddComponent<Image>(); im.sprite = circle; im.color = c;
            var r = im.rectTransform; r.anchorMin = r.anchorMax = anchor; r.anchoredPosition = pos; r.sizeDelta = size;
            return im;
        }

        static void Button(Transform p, string label, Vector2 pos, float size, Color c, System.Action<bool> onHold, bool left = false)
        {
            var im = Circle(p, left ? new Vector2(0, 0) : new Vector2(1, 0), pos, new Vector2(size, size), c);
            var t = HUD.Label(im.transform, label, Mathf.RoundToInt(size * 0.17f), new Vector2(0.5f, 0.5f), Vector2.zero, TextAnchor.MiddleCenter, Color.white);
            t.rectTransform.sizeDelta = new Vector2(size, size); t.raycastTarget = false;
            im.gameObject.AddComponent<HoldButton>().onHold = onHold;
        }

        static Sprite MakeCircle()
        {
            const int S = 128; var tex = new Texture2D(S, S, TextureFormat.RGBA32, false);
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++)
                {
                    float d = Vector2.Distance(new Vector2(x, y), new Vector2(S / 2f - 0.5f, S / 2f - 0.5f)) / (S / 2f);
                    float a = Mathf.Clamp01((1f - d) * 30f); float ring = d > 0.9f ? 1f : 0.85f;
                    tex.SetPixel(x, y, new Color(ring, ring, ring, a));
                }
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f));
        }
    }

    public class HoldButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public System.Action<bool> onHold;
        public void OnPointerDown(PointerEventData e) { onHold?.Invoke(true); transform.localScale = Vector3.one * 0.93f; }
        public void OnPointerUp(PointerEventData e) { onHold?.Invoke(false); transform.localScale = Vector3.one; }
        public void OnPointerExit(PointerEventData e) { onHold?.Invoke(false); transform.localScale = Vector3.one; }
    }

    public class Joystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public RectTransform knob; RectTransform rt;
        void Awake() { rt = GetComponent<RectTransform>(); }
        public void OnPointerDown(PointerEventData e) { OnDrag(e); }
        public void OnDrag(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(rt, e.position, e.pressEventCamera, out var lp);
            var v = Vector2.ClampMagnitude(lp / (rt.sizeDelta.x * 0.5f), 1f);
            GameInput.TouchMove = v; knob.anchoredPosition = v * rt.sizeDelta.x * 0.3f;
        }
        public void OnPointerUp(PointerEventData e) { GameInput.TouchMove = Vector2.zero; knob.anchoredPosition = Vector2.zero; }
    }

    public class CameraDrag : MonoBehaviour, IDragHandler
    {
        public void OnDrag(PointerEventData e) { CameraRig.Look(new Vector2(e.delta.x * 0.25f, e.delta.y * 0.18f)); }
    }
}
