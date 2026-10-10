// Genera los manifest.xml del complemento:
//   dist/manifest.xml        → GitHub Pages (el que se instala en Excel Mac y web)
//   manifest.local.xml       → https://localhost:3000 (desarrollo)
// Uso: node tools/manifest.mjs [urlBase]
import { writeFileSync, mkdirSync } from 'node:fs';

const PAGES = process.argv[2] || process.env.URL_BASE || 'https://omarjust.github.io/evaluador-proyectos-excel/';
const LOCAL = 'https://localhost:3000/';
const ID = '440b3c6b-404d-4de6-88e1-4786c02f0ae4';
const VERSION = '1.0.0.0';

const xml = (base, sufijo = '') => {
  const b = base.endsWith('/') ? base : base + '/';
  const dominio = new URL(b).origin;
  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
  xsi:type="TaskPaneApp">
  <Id>${sufijo ? ID.replace(/.$/, '5') : ID}</Id>
  <Version>${VERSION}</Version>
  <ProviderName>Evaluación de Proyectos UPB</ProviderName>
  <DefaultLocale>es-ES</DefaultLocale>
  <DisplayName DefaultValue="Evaluador de Proyectos${sufijo}"/>
  <Description DefaultValue="Flujo de caja, depreciación, préstamo, VAC y CAE, sensibilidad, araña, Monte Carlo y preguntas de riesgo explicadas con su porqué."/>
  <IconUrl DefaultValue="${b}assets/icon-32.png"/>
  <HighResolutionIconUrl DefaultValue="${b}assets/icon-64.png"/>
  <SupportUrl DefaultValue="${b}"/>
  <AppDomains>
    <AppDomain>${dominio}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Workbook"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="ExcelApi" MinVersion="1.7"/>
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="${b}index.html"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Workbook">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="Inicio.Titulo"/>
            <Description resid="Inicio.Descripcion"/>
            <LearnMoreUrl resid="Inicio.Url"/>
          </GetStarted>
          <FunctionFile resid="Panel.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="Evaluador.Grupo">
                <Label resid="Grupo.Etiqueta"/>
                <Icon>
                  <bt:Image size="16" resid="Icono.16"/>
                  <bt:Image size="32" resid="Icono.32"/>
                  <bt:Image size="80" resid="Icono.80"/>
                </Icon>
                <Control xsi:type="Button" id="Evaluador.Abrir">
                  <Label resid="Boton.Etiqueta"/>
                  <Supertip>
                    <Title resid="Boton.Etiqueta"/>
                    <Description resid="Boton.Ayuda"/>
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icono.16"/>
                    <bt:Image size="32" resid="Icono.32"/>
                    <bt:Image size="80" resid="Icono.80"/>
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>EvaluadorPanel</TaskpaneId>
                    <SourceLocation resid="Panel.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="Icono.16" DefaultValue="${b}assets/icon-16.png"/>
        <bt:Image id="Icono.32" DefaultValue="${b}assets/icon-32.png"/>
        <bt:Image id="Icono.80" DefaultValue="${b}assets/icon-80.png"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="Inicio.Url" DefaultValue="${b}"/>
        <bt:Url id="Panel.Url" DefaultValue="${b}index.html"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="Inicio.Titulo" DefaultValue="Evaluador de Proyectos listo"/>
        <bt:String id="Grupo.Etiqueta" DefaultValue="Evaluación"/>
        <bt:String id="Boton.Etiqueta" DefaultValue="Evaluador"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="Inicio.Descripcion" DefaultValue="Abre el panel desde Inicio y pulsa Evaluador. Carga un ejemplo o tus datos."/>
        <bt:String id="Boton.Ayuda" DefaultValue="Abre el panel para armar el flujo de caja, el análisis de riesgo y el diagnóstico."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;
};

mkdirSync('dist', { recursive: true });
writeFileSync('dist/manifest.xml', xml(PAGES));
writeFileSync('manifest.xml', xml(PAGES));
writeFileSync('manifest.local.xml', xml(LOCAL, ' (local)'));
console.log('manifest.xml →', PAGES);
