# HairCamp Figma Generator v1.0

HairCamp Figma Generator는 ChatGPT가 별도로 작성한 강의기획 JSON을 Figma의 `DETAIL_PAGE` 템플릿 복제본에 자동으로 입력하는 Figma Development Plugin입니다.

## 프로그램이 하는 일

- 현재 열려 있는 Figma 파일에서 `DETAIL_PAGE` 원본 Frame을 찾습니다.
- JSON의 `frameName`과 Section, `TXT_` Text Layer 이름을 검사합니다.
- Validate가 성공한 경우에만 `DETAIL_PAGE`를 복제합니다.
- 복제본 이름을 JSON의 `frameName`으로 바꿉니다.
- 복제본 내부의 지정된 `TXT_` Text Layer `characters` 값만 변경합니다.
- 완료 후 생성된 Frame을 선택하고 화면에 보여줍니다.

## 프로그램이 하지 않는 일

- 문구를 새로 작성하거나 요약하지 않습니다.
- AI API, 서버, 데이터베이스, Firebase, Supabase를 사용하지 않습니다.
- JSON이나 Figma 데이터를 외부로 전송하지 않습니다.
- 이미지, Fill, 폰트, 크기, 색상, Auto Layout, 레이어 위치, 레이어 이름을 변경하지 않습니다.
- 원본 `DETAIL_PAGE`는 수정하지 않습니다.

## 비용 발생 여부

실행에 유료 API나 유료 서버가 필요하지 않습니다. 개발 의존성은 무료 오픈소스 패키지인 TypeScript, esbuild, Figma Plugin typings만 사용합니다.

## 설치 방법

```bash
pnpm install
```

이미 이 폴더에서 Codex가 의존성을 설치했다면 다시 설치하지 않아도 됩니다.

## 빌드 방법

```bash
pnpm build
```

빌드가 끝나면 Figma가 읽을 파일이 생성됩니다.

```text
dist/code.js
dist/ui.html
```

## 테스트 방법

```bash
pnpm typecheck
pnpm test
```

## Figma Desktop에서 개발 플러그인 불러오기

1. Figma Desktop을 실행합니다.
2. HairCamp 템플릿 파일을 엽니다.
3. 메뉴에서 `Plugins` → `Development` → `Import plugin from manifest...`를 선택합니다.
4. 이 프로젝트의 `manifest.json` 파일을 선택합니다.
5. `HairCamp Figma Generator`가 Development Plugin 목록에 나타나면 준비가 끝난 것입니다.

## 플러그인 실행 방법

1. Figma에서 HairCamp 템플릿 파일을 엽니다.
2. `DETAIL_PAGE` 원본 Frame이 정확히 1개 있는지 확인합니다.
3. 메뉴에서 `Plugins` → `Development` → `HairCamp Figma Generator`를 실행합니다.

## JSON 붙여넣기 방법

플러그인 UI의 `JSON 데이터` 입력 영역에 ChatGPT가 작성한 JSON을 그대로 붙여넣습니다. 앞뒤 공백이나 내용은 플러그인이 자동 수정하지 않습니다.

## JSON 파일 업로드 방법

`.json` 파일을 업로드 영역에서 선택하거나, 업로드 영역으로 드래그 앤 드롭합니다. 파일 내용은 Textarea에 표시되므로 실행 전에 직접 확인할 수 있습니다.

## Validate 사용 방법

`Validate` 버튼을 누르면 실제 Frame을 만들지 않고 아래 내용을 검사합니다.

- JSON 문법
- `frameName`
- Section 구조
- 모든 Layer Key의 `TXT_` 시작 여부
- `DETAIL_PAGE` 원본 개수
- Section과 Text Layer 존재 여부
- 중복 Section과 중복 Text Layer
- Text Layer 타입
- 기존 폰트 로딩 가능 여부

오류가 하나라도 있으면 `Generate` 버튼은 활성화되지 않습니다.

## Generate 사용 방법

Validate가 성공하면 `Generate` 버튼이 활성화됩니다. Generate는 다시 한 번 현재 JSON과 템플릿을 검사한 뒤 실행됩니다.

실행 중 오류가 발생하면 생성 중이던 복제본을 삭제하고 원본 `DETAIL_PAGE`는 그대로 둡니다.

## 정상 JSON 예시

```json
{
  "frameName": "김우진_자연스러운 컬을 만드는 슬릭펌 디자인",
  "Main banner": {
    "TXT_HERO_SUBTITLE": "자연스러운 질감과 흐름을 설계하는",
    "TXT_HERO_TITLE": "슬릭펌 디자인",
    "TXT_INSTRUCTOR_NAME": "김우진"
  },
  "Class_1": {
    "TXT_CLASS1_TITLE": "강의 특징",
    "TXT_CLASS1_DESC": "고객의 모질과 두상에 맞춰 자연스러운 컬을 설계합니다."
  }
}
```

더 긴 예시는 `sample/valid-haircamp.json`에 있습니다.

## 자주 발생하는 오류와 해결 방법

- `DETAIL_PAGE 원본 Frame을 찾을 수 없습니다.`: Figma 파일에 `DETAIL_PAGE`라는 최상위 Frame을 준비하세요.
- `DETAIL_PAGE 원본 Frame이 2개 발견되었습니다.`: 원본 템플릿은 1개만 남기세요.
- `Section을 찾을 수 없습니다.`: JSON의 최상위 Section 이름과 Figma 레이어 이름이 대소문자까지 같은지 확인하세요.
- `레이어 이름은 TXT_로 시작해야 합니다.`: JSON의 Text Layer Key는 반드시 `TXT_`로 시작해야 합니다.
- `Text Layer가 아닙니다.`: JSON에서 지정한 이름이 Figma에서 실제 Text Layer인지 확인하세요.
- `폰트를 불러올 수 없습니다.`: 해당 폰트가 Figma에서 사용 가능한 상태인지 확인하세요.
- `JSON 또는 Template이 변경되었습니다.`: JSON을 수정한 뒤 다시 Validate를 실행하세요.

## 원본 DETAIL_PAGE 보호 원칙

이 플러그인은 원본 `DETAIL_PAGE`를 직접 수정하지 않습니다. 항상 원본을 복제한 뒤 복제본만 수정합니다. 수정 대상은 복제된 최상위 Frame 이름과 `TXT_` Text Layer의 `characters` 값뿐입니다.

## 새로운 Template 추가 방법

v1.0 UI에는 `HairCamp DETAIL_PAGE`만 표시됩니다. 이후 템플릿을 추가하려면 `src/shared/constants.ts`의 `templates` 배열에 항목을 추가합니다.

```ts
{
  id: "bob-academy-detail-v1",
  displayName: "BOB Academy DETAIL_PAGE",
  sourceFrameName: "DETAIL_PAGE",
  duplicateGap: 200
}
```

템플릿별로 같은 규칙을 사용한다면 검색과 생성 로직을 새로 만들 필요가 없습니다.
