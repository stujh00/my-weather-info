import Board from '@/components/Board';
import FixturePanel from '@/components/FixturePanel';

export default function Page() {
  return (
    <main>
      <h1>오늘의 진짜 정보판 — 서울 기온</h1>
      <p className="subtitle">
        Open-Meteo 공개 API(비밀키 불필요)에서 실제 기온을 조회해 매일 한 건씩 기록하고, 실패해도 마지막
        정상값을 지우지 않는 정보판입니다. 
      </p>
      <Board />
      <FixturePanel />
    </main>
  );
}
