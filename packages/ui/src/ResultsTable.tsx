'use client';

export interface ResultRow {
  tick: number;
  type: string;
  points: number;
  multiplier: number;
}

export function ResultsTable(props: { events: readonly ResultRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Tick</th>
          <th>Type</th>
          <th>Points</th>
          <th>Multiplier</th>
        </tr>
      </thead>
      <tbody>
        {props.events.map((event, index) => (
          <tr key={`${event.tick}-${event.type}-${index}`}>
            <td>{event.tick}</td>
            <td>{event.type}</td>
            <td>{event.points}</td>
            <td>{event.multiplier}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
