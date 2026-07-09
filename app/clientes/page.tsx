"use client";

import { useState } from "react";
import { Client } from "@/types";
import { clientsService } from "@/services/catalog.service";
import { useSession } from "@/components/session-provider";
import { useData } from "@/components/use-data";
import {
  Badge, Button, EmptyState, ErrorText, Field, Input, Modal, NoAccess, PageHeader, Table, Td, Textarea
} from "@/components/ui";
import { required, validate } from "@/lib/validation";

const empty: Partial<Client> = { name: "", ceco: "", description: "", active: true };

export default function ClientesPage() {
  const { can, user, refreshData } = useSession();
  const { data: clients } = useData(() => clientsService.list(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Client>>(empty);
  const [errors, setErrors] = useState<string[]>([]);

  if (!can("clients.view")) return <NoAccess />;
  const canManage = can("clients.manage");

  function edit(client: Client) {
    setForm(client);
    setErrors([]);
    setOpen(true);
  }
  function create() {
    setForm(empty);
    setErrors([]);
    setOpen(true);
  }

  async function save() {
    const result = validate(required(form.name, "Nombre"), required(form.ceco, "CECO"));
    if (!result.valid) return setErrors(result.errors);
    const payload = {
      name: form.name!.trim(),
      ceco: form.ceco!.trim(),
      description: form.description ?? null,
      active: form.active ?? true
    };
    if (form.id) {
      await clientsService.update(form.id, payload, user?.id);
    } else {
      await clientsService.create(payload, user?.id);
    }
    setOpen(false);
    refreshData();
  }

  async function remove(client: Client) {
    if (!window.confirm(`Eliminar cliente ${client.name}?`)) return;
    await clientsService.remove(client.id);
    refreshData();
  }

  return (
    <div>
      <PageHeader
        title="Clientes / CECOs"
        subtitle="Clientes y centros de coste. Obligatorio al registrar entradas de material."
        actions={canManage ? <Button onClick={create}>+ Nuevo cliente</Button> : undefined}
      />

      {!clients?.length ? (
        <EmptyState message="No hay clientes." />
      ) : (
        <Table headers={["Nombre", "CECO", "Descripcion", "Estado", "Origen", ""]}>
          {clients.map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">{c.name}</Td>
              <Td className="font-mono text-xs">{c.ceco}</Td>
              <Td className="max-w-xs text-gray-500">{c.description || "-"}</Td>
              <Td>
                <Badge tone={c.active ? "green" : "gray"}>{c.active ? "Activo" : "Inactivo"}</Badge>
              </Td>
              <Td>
                <Badge tone={c.sourceSystem === "merchanops" ? "purple" : "gray"}>{c.sourceSystem}</Badge>
              </Td>
              <Td>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => edit(c)}>Editar</Button>
                    <Button variant="danger" onClick={() => remove(c)}>Eliminar</Button>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal title={form.id ? "Editar cliente" : "Nuevo cliente"} open={open} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3">
          <ErrorText errors={errors} />
          <Field label="Nombre">
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="CECO / Codigo">
            <Input value={form.ceco ?? ""} onChange={(e) => setForm({ ...form, ceco: e.target.value })} />
          </Field>
          <Field label="Descripcion">
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Activo">
            <select
              value={form.active ? "1" : "0"}
              onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
