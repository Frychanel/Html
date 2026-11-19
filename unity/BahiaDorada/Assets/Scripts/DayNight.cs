using UnityEngine;

namespace BahiaDorada
{
    // Ciclo de día y noche: 1 minuto de juego = 1 segundo real.
    public class DayNight : MonoBehaviour
    {
        public static float Minutes = 9 * 60;
        public static float Night;
        Light sun; Material sky; float giT;

        void Start()
        {
            var go = new GameObject("Sol"); sun = go.AddComponent<Light>(); sun.type = LightType.Directional;
            sun.shadows = LightShadows.Soft; sun.shadowStrength = 0.85f; sun.shadowBias = 0.04f; sun.shadowNormalBias = 0.3f;
            RenderSettings.sun = sun;
            var tpl = Resources.Load<Material>("Sky");
            sky = tpl ? new Material(tpl) : new Material(Shader.Find("Skybox/Procedural"));
            RenderSettings.skybox = sky; RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Skybox;
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 180; RenderSettings.fogEndDistance = 600;
            QualitySettings.shadowDistance = 140; QualitySettings.shadowCascades = 2;
        }

        void Update()
        {
            Minutes = (Minutes + Time.deltaTime) % 1440f;
            float ang = (Minutes / 1440f - 0.25f) * 360f;               // 6:00 amanecer, 18:00 anochecer
            float elev = Mathf.Sin(ang * Mathf.Deg2Rad);
            float day = Mathf.Clamp01((elev + 0.1f) / 0.38f); Night = 1 - day;
            sun.transform.rotation = Quaternion.Euler(elev > -0.05f ? ang : ang + 180f, 30f, 0);
            sun.intensity = day > 0.05f ? 1.25f * day : 0.25f;
            sun.color = day > 0.05f ? Color.Lerp(new Color(1f, 0.6f, 0.35f), new Color(1f, 0.96f, 0.9f), Mathf.Clamp01(elev * 3)) : new Color(0.55f, 0.65f, 1f);
            if (sky.HasProperty("_Exposure")) sky.SetFloat("_Exposure", Mathf.Lerp(0.15f, 1.3f, day));
            if (sky.HasProperty("_AtmosphereThickness")) sky.SetFloat("_AtmosphereThickness", Mathf.Lerp(0.7f, 1.0f, day));
            RenderSettings.fogColor = Color.Lerp(new Color(0.06f, 0.08f, 0.16f), new Color(0.72f, 0.82f, 0.92f), day);
            RenderSettings.ambientIntensity = Mathf.Lerp(0.55f, 1.1f, day);
            Mats.SetNight(Night);
            giT -= Time.deltaTime; if (giT <= 0) { giT = 2f; DynamicGI.UpdateEnvironment(); }
        }
    }
}
