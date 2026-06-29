const { PrismaClient } = require("@prisma/client");
const log = require("./logger");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const MIDSUIT_URL = "https://erp.julongindonesia.com:8443/api";

const getToken = async () => {
  try {
    const options = {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        username: "SuperUser",
        password: "JgiMidsuit123!",
      }),
    };
    const res = await fetch(`${MIDSUIT_URL}/login`, options);
    const result = await res.json();
    if (result && result.data && result.data.token) {
      return result.data.token;
    }
    return null;
  } catch (error) {
    log.error("Error getting token:", error.message);
    return null;
  }
};

// 1. Sinkronisasi Organisasi
const syncOrganization = async (token) => {
  log.info("Mulai sinkronisasi Organisasi...");
  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    const res = await fetch(`${MIDSUIT_URL}/organizations`, options);
    const result = await res.json();

    if (result && Array.isArray(result.data) && result.data.length) {
      const org = await db.m_organization.findMany({});
      const data = [];

      result.data.forEach((e) => {
        const f = org.find((ex) => ex.ad_org_id === e.ad_org_id);
        let address =
          e.org_info &&
          Array.isArray(e.org_info.locations) &&
          e.org_info.locations.length
            ? e.org_info.address
            : null;

        if (f) {
          log.info(`Update Organisasi: ${e.name}`);
          data.push({
            id: f.id,
            name: e.name,
            address: address,
            ad_org_id: e.ad_org_id,
          });
        } else {
          log.info(`Buat Organisasi baru: ${e.name}`);
          data.push({ name: e.name, address: address, ad_org_id: e.ad_org_id });
        }
      });

      const transactions = data.map((d) => {
        if (d.id) {
          return db.m_organization.update({
            where: { id: d.id },
            data: { name: d.name, address: d.address, ad_org_id: d.ad_org_id },
          });
        } else {
          return db.m_organization.create({
            data: { name: d.name, address: d.address, ad_org_id: d.ad_org_id },
          });
        }
      });
      await db.$transaction(transactions, { maxWait: 10000, timeout: 60000 });
      log.info(`Berhasil sinkronisasi ${transactions.length} Organisasi`);
      return data;
    }
  } catch (error) {
    log.error("Gagal sinkronisasi organisasi:", error.message);
  }
};

// 2. Sinkronisasi Struktur Organisasi
const syncOrganizationStructure = async (token) => {
  log.info("Mulai sinkronisasi Struktur Organisasi...");
  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    const organization = await db.m_organization.findMany({
      where: { ad_org_id: { not: null } },
    });

    if (organization.length) {
      for (const item of organization) {
        const res = await fetch(
          `${MIDSUIT_URL}/organizations/${item.ad_org_id}/structures`,
          options,
        );
        const result = await res.json();

        if (result && Array.isArray(result.data) && result.data.length) {
          log.info(
            `Ditemukan ${result.data.length} struktur untuk Organisasi ID ${item.ad_org_id}`,
          );
          const org = await db.m_organization_structure.findMany({
            where: { id_org: item.id },
          });

          const data = [];
          result.data.forEach((e) => {
            const f = org.find((ex) => ex.hc_org_id === e.hc_org_id);
            let resObj = {
              name: e.name,
              hc_org_id: e.hc_org_id,
              id_org: item.id,
              _marker: {
                id: e.hc_org_id,
                parent: e.parent_id,
              },
            };
            if (f) {
              log.info(`Update Struktur: ${e.name}`);
              resObj.id = f.id;
            } else {
              log.info(`Buat Struktur baru: ${e.name}`);
            }
            data.push(resObj);
          });

          const transactions = data.map((d) => {
            const { _marker, id, ...prismaData } = d;
            if (id) {
              return db.m_organization_structure.update({
                where: { id },
                data: prismaData,
              });
            } else {
              return db.m_organization_structure.create({ data: prismaData });
            }
          });

          const transactionResults = await db.$transaction(transactions, {
            maxWait: 10000,
            timeout: 60000,
          });

          const structures = transactionResults.map((res, i) => ({
            ...res,
            _marker: data[i]._marker,
          }));

          let structures_parent = structures.map((e) => {
            if (e._marker.parent) {
              const f = structures.find(
                (ex) => ex._marker.id === e._marker.parent,
              );
              return {
                ...e,
                id_parent: f ? f.id : null,
              };
            } else {
              return {
                ...e,
                id_parent: null,
              };
            }
          });

          const parentTransactions = structures_parent.map((e) => {
            return db.m_organization_structure.update({
              where: { id: e.id },
              data: { id_parent: e.id_parent },
            });
          });

          if (parentTransactions.length > 0) {
            await db.$transaction(parentTransactions, {
              maxWait: 10000,
              timeout: 60000,
            });
          }
        }
      }
      log.info("Berhasil sinkronisasi Struktur Organisasi");
    }
  } catch (error) {
    log.error("Gagal sinkronisasi Struktur Organisasi:", error.message);
  }
};

// 3. Sinkronisasi Posisi
const syncPosition = async (token) => {
  log.info("Mulai sinkronisasi Posisi...");
  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    const organization = await db.m_organization.findMany({
      where: { ad_org_id: { not: null } },
    });

    if (organization.length) {
      for (const item of organization) {
        try {
          const res = await fetch(
            `${MIDSUIT_URL}/organizations/${item.ad_org_id}/jobs`,
            options,
          );
          const result = await res.json();

          if (result && Array.isArray(result.data) && result.data.length) {
            log.info(
              `Ditemukan ${result.data.length} posisi untuk Organisasi ID ${item.ad_org_id}`,
            );
            const org = await db.m_position.findMany({
              where: { id_org: item.id },
            });

            const data_structure = result.data.filter((e) => e.hc_org_id);
            const id_structure = data_structure.map((e) => e.hc_org_id);

            const depts = await db.m_organization_structure.findMany({
              where: { hc_org_id: { in: id_structure } },
            });

            const data = [];
            result.data.forEach((e) => {
              let resObj = {
                name: e.name,
                hc_job_id: e.hc_job_id,
                id_org: item.id,
                id_department: null,
                _marker: {
                  id: e.hc_job_id,
                  parent: e.parent_id,
                },
              };

              if (e.hc_org_id) {
                const dep = depts.find((ex) => ex.hc_org_id === e.hc_org_id);
                if (dep) {
                  resObj.id_department = dep.id;
                }
              }

              if (org.length) {
                const f = org.find((ex) => ex.hc_job_id === e.hc_job_id);
                if (f) {
                  log.info(`Update Posisi: ${e.name}`);
                  resObj.id = f.id;
                } else {
                  log.info(`Buat Posisi baru: ${e.name}`);
                }
              } else {
                log.info(`Buat Posisi baru: ${e.name}`);
              }
              data.push(resObj);
            });

            const transactions = data.map((d) => {
              const { _marker, id, ...prismaData } = d;
              if (id) {
                return db.m_position.update({
                  where: { id },
                  data: prismaData,
                });
              } else {
                return db.m_position.create({ data: prismaData });
              }
            });

            const transactionResults = await db.$transaction(transactions, {
              maxWait: 10000,
              timeout: 60000,
            });

            const structures = transactionResults.map((res, i) => ({
              ...res,
              _marker: data[i]._marker,
            }));

            let structures_parent = structures.map((e) => {
              if (e._marker.parent) {
                const f = structures.find(
                  (ex) => ex._marker.id === e._marker.parent,
                );
                return {
                  ...e,
                  id_parent: f ? f.id : null,
                };
              } else {
                return {
                  ...e,
                  id_parent: null,
                };
              }
            });

            const parentTransactions = structures_parent.map((e) => {
              return db.m_position.update({
                where: { id: e.id },
                data: { id_parent: e.id_parent },
              });
            });

            if (parentTransactions.length > 0) {
              await db.$transaction(parentTransactions, {
                maxWait: 10000,
                timeout: 60000,
              });
            }
          }
        } catch (ex) {
          log.error("Error pada posisi org:", ex.message);
        }
      }
      log.info("Berhasil sinkronisasi Posisi");
    }
  } catch (error) {
    log.error("Gagal sinkronisasi Posisi:", error.message);
  }
};

// 4. Sinkronisasi Karyawan
const syncEmployee = async (token) => {
  log.info("Mulai sinkronisasi Karyawan...");
  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    const organization = await db.m_organization.findMany({
      where: { ad_org_id: { not: null } },
    });

    if (organization.length) {
      for (const item of organization) {
        try {
          const res = await fetch(
            `${MIDSUIT_URL}/organizations/${item.ad_org_id}/employees`,
            options,
          );
          const result = await res.json();
          if (result) {
            const data = Array.isArray(result.data) ? result.data : [];
            log.info(
              `Ditemukan ${data.length} karyawan untuk Organisasi ID ${item.ad_org_id}`,
            );
            if (data.length) {
              const dept = await db.m_organization_structure.findMany({
                where: { id_org: item.id },
              });
              const position = await db.m_position.findMany({
                where: { id_org: item.id },
              });
              await upsert_employee(data, dept, position, item.id);
            }
          }
        } catch (ex) {
          log.error("Error pada employee org:", ex.message);
        }
      }
      log.info("Berhasil sinkronisasi Karyawan");
    }
  } catch (error) {
    log.error("Gagal sinkronisasi Karyawan:", error.message);
  }
};

const upsert_employee = async (list, department, position, id_org) => {
  const code_employee = list.map((e) => e.hc_employee_id);
  const employee = await db.m_employee.findMany({
    where: { hc_employee_id: { in: code_employee } },
  });

  const upsert_data = list.map((emp) => {
    let data = {
      name: emp.name,
      npwp: emp.npwp,
      gender: emp.gender,
      age: emp.age_year,
      home_address: emp.address,
      status: emp.status === "A" ? "active" : "inactive",
      company_address: emp?.employee_job?.work_site?.address,
      hc_employee_id: emp?.hc_employee_id,
      id_org: id_org,
      nik: emp.nik,
    };
    let ep = employee.find((ex) => ex.hc_employee_id === emp.hc_employee_id);
    if (ep) {
      log.info(`Update data Karyawan: ${emp.name}`);
      data.id = ep.id;
    } else {
      log.info(`Buat data Karyawan baru: ${emp.name}`);
    }

    const fDept = department.find(
      (e) => e.hc_org_id === emp?.employee_job?.hc_org_id,
    );
    data.id_department = fDept ? fDept.id : null;

    const fPos = position.find(
      (e) => e.hc_job_id === emp?.employee_job?.hc_job_id,
    );
    data.id_position = fPos ? fPos.id : null;

    return data;
  });

  // Pass 1: Upsert m_employee
  const empTransactions = upsert_data.map((d) => {
    if (d.id) {
      const { id, ...rest } = d;
      return db.m_employee.update({ where: { id }, data: rest });
    } else {
      return db.m_employee.create({ data: d });
    }
  });

  await db.$transaction(empTransactions, { maxWait: 10000, timeout: 60000 });

  // Fetch updated employees to get IDs
  const staff = await db.m_employee.findMany({
    where: { hc_employee_id: { in: code_employee } },
    include: {
      m_organization: true,
      m_employee_position: true,
      m_position: {
        include: {
          other_m_position: {
            include: {
              m_employee: true,
            },
          },
        },
      },
    },
  });

  const posisi_employee = [];
  const users = [];
  let passwordUtil = { hash: (str) => str };
  try {
    const bcrypt = require("./bcrypt.js");
    passwordUtil = {
      hash: (pass) => {
        const salt = bcrypt.genSaltSync(10);
        return bcrypt.hashSync(pass, salt);
      },
    };
  } catch (e) {
    log.error(
      "Warning: gagal meload bcrypt.js, menggunakan crypto fallback.",
      e.message,
    );
    passwordUtil = {
      hash: (str) =>
        require("crypto")
          .createHash("sha256")
          .update(str || "")
          .digest("hex"),
    };
  }

  staff.forEach((e) => {
    if (!e.id_position) return;

    // Determine is_manager
    let is_manager = false;
    if (e.m_position) {
      const other_position = e.m_position.other_m_position || [];
      if (other_position.length) {
        const hasStaff = other_position.find((ex) => {
          return ex && ex.m_employee && ex.m_employee.length > 0;
        });
        if (hasStaff) is_manager = true;
      }
    }

    // Determine Role ID
    let roleId = "b6e2aa92-7074-42a4-82cb-28f72fb571b8"; // employee
    if (
      e.m_department &&
      (e.m_department.name === "Human Resource" ||
        e.m_department.name === "HRIS & Performance Management")
    ) {
      roleId = "1e9547a4-7699-40b5-b85e-c830953c3dbe"; // hrd
    } else if (is_manager) {
      roleId = "7824aaec-f39d-4038-aadb-e55ad6a76f71"; // manager
    }

    if (e.id_user) {
      log.info(`User untuk karyawan ${e.name} sudah ada, siap diupdate`);
      const user = {
        id: e.id_user,
        username: e.nik,
        name: e.name,
        email: e.nik,
        m_role: { connect: { id: roleId } },
        _marker: { id_employee: e.id },
      };
      users.push(user);
    } else {
      log.info(`User untuk karyawan ${e.name} belum ada, buat user baru`);
      const user = {
        username: e.nik,
        name: e.name,
        reset_password: true,
        password: passwordUtil.hash(e.nik),
        email: e.nik,
        m_role: { connect: { id: roleId } },
        _marker: { id_employee: e.id },
      };
      users.push(user);
    }

    // Determine is_pk
    let is_pk = false;
    if (is_manager) {
      let f = staff.find((ex) => e.id_position === ex.id_position && ex.is_pk);
      if (!f) is_pk = true;
    }
    e.is_pk = is_pk;

    let empPosId = null;
    if (e.m_employee_position && e.m_employee_position.length > 0) {
      empPosId = e.m_employee_position[0].id;
    }

    if (e.id_position && e.id_department) {
      let m_employee_position = {
        is_pk,
        m_position: { connect: { id: e.id_position } },
        m_organization_structure: { connect: { id: e.id_department } },
        m_employee: { connect: { id: e.id } },
      };

      if (empPosId) {
        m_employee_position.id = empPosId;
      }
      posisi_employee.push(m_employee_position);
    }
  });

  // Pass 2: Upsert m_employee_position
  const posTransactions = posisi_employee.map((p) => {
    const { id, ...rest } = p;
    if (id) {
      return db.m_employee_position.update({ where: { id }, data: rest });
    } else {
      return db.m_employee_position.create({ data: rest });
    }
  });
  if (posTransactions.length > 0) {
    await db.$transaction(posTransactions, { maxWait: 10000, timeout: 60000 });
  }

  // Pass 3: Upsert m_user
  const usernames = users.map((u) => u.username);
  const existingUsers = await db.m_user.findMany({
    where: { username: { in: usernames } },
  });

  const userTransactions = users.map((u) => {
    const { _marker, id, ...rest } = u;
    const existing = existingUsers.find((ex) => ex.username === u.username);

    if (id || existing) {
      const updateId = id || existing.id;
      return db.m_user.update({ where: { id: updateId }, data: rest });
    } else {
      return db.m_user.create({ data: rest });
    }
  });

  const userResults = [];
  if (userTransactions.length > 0) {
    const ur = await db.$transaction(userTransactions, {
      maxWait: 10000,
      timeout: 60000,
    });
    userResults.push(...ur);
  }

  // Match back and update m_employee with id_user
  const empUpdateTransactions = userResults
    .map((ur) => {
      const u = users.find((x) => x.username === ur.username);
      if (u && u._marker && u._marker.id_employee) {
        return db.m_employee.update({
          where: { id: u._marker.id_employee },
          data: { id_user: ur.id },
        });
      }
    })
    .filter(Boolean);

  if (empUpdateTransactions.length > 0) {
    await db.$transaction(empUpdateTransactions, {
      maxWait: 10000,
      timeout: 60000,
    });
  }

  await sinkron_role();
};

const sinkron_role = async () => {
  const employee = await db.m_user.findMany({
    include: { m_role: true },
  });
  const role = await db.m_role.findMany({});
  const child_role = [
    { name: "super_admin", child: ["hrd", "manager", "employee"] },
    { name: "hrd", child: ["manager", "employee"] },
    { name: "manager", child: ["employee"] },
    { name: "employee", child: [] },
  ];

  const findRoleId = (name) => {
    const result = role.find((e) => e.name === name);
    return result ? result.id : null;
  };

  const mapping_children_role = (id_user, user_role) => {
    const your_role = child_role.find((e) => e.name === user_role);
    const data = your_role ? your_role.child : [];
    const result = [];
    if (data.length) {
      data.forEach((e) => {
        const id_role = findRoleId(e);
        if (id_role) {
          result.push({ id_user, id_role });
        }
      });
    }
    return result;
  };

  let data = [];
  employee.forEach((e) => {
    if (e.m_role && e.m_role.name) {
      const id_role = findRoleId(e.m_role.name);
      if (id_role) {
        data.push({ id_user: e.id, id_role });
      }
      let child = mapping_children_role(e.id, e.m_role.name);
      if (child.length) {
        data = data.concat(child);
      }
    }
  });

  const uniqueData = [];
  const seen = new Set();
  data.forEach((d) => {
    const key = `${d.id_user}_${d.id_role}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueData.push(d);
    }
  });

  const userIds = employee.map((e) => e.id);

  if (userIds.length > 0) {
    await db.$transaction(
      [
        db.m_user_role.deleteMany({ where: { id_user: { in: userIds } } }),
        db.m_user_role.createMany({ data: uniqueData }),
      ],
      { maxWait: 10000, timeout: 60000 },
    );
  }
};

const runFullSync = async (manualToken) => {
  let token = manualToken;
  if (!token || token === "DUMMY_TOKEN") {
    token = await getToken();
  }

  if (!token) {
    return { status: "error", message: "Gagal mendapatkan token auth" };
  }

  try {
    await syncOrganization(token);
    await syncOrganizationStructure(token);
    await syncPosition(token);
    await syncEmployee(token);
    return { status: "success", message: "Semua data berhasil disinkronkan" };
  } catch (error) {
    console.error("Gagal sinkronisasi:", error);
    return { status: "error", message: error.message };
  }
};

module.exports = {
  runFullSync,
  getToken,
};
